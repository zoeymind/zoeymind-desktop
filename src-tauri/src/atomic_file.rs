use std::{
  fs::{self, File, OpenOptions},
  io::{self, Write},
  path::{Path, PathBuf},
  sync::atomic::{AtomicU64, Ordering},
};

static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
const TEMP_MARKER: &str = ".zoeymind-write-";

fn temporary_path(target: &Path) -> io::Result<PathBuf> {
  let parent = target
    .parent()
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no parent directory"))?;
  let name = target
    .file_name()
    .and_then(|value| value.to_str())
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target filename is not valid UTF-8"))?;
  let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
  Ok(parent.join(format!(
    ".{name}{TEMP_MARKER}{}-{sequence}.tmp",
    std::process::id()
  )))
}

fn create_temporary_file(target: &Path) -> io::Result<(PathBuf, File)> {
  for _ in 0..100 {
    let path = temporary_path(target)?;
    match OpenOptions::new().write(true).create_new(true).open(&path) {
      Ok(file) => return Ok((path, file)),
      Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
      Err(error) => return Err(error),
    }
  }
  Err(io::Error::new(
    io::ErrorKind::AlreadyExists,
    "could not allocate a unique temporary file",
  ))
}

#[cfg(not(target_os = "windows"))]
fn replace_file(temp: &Path, target: &Path) -> io::Result<()> {
  fs::rename(temp, target)
}

#[cfg(target_os = "windows")]
fn replace_file(temp: &Path, target: &Path) -> io::Result<()> {
  use std::os::windows::ffi::OsStrExt;
  use windows_sys::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
  };

  let temp_wide: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
  let target_wide: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
  let result = unsafe {
    MoveFileExW(
      temp_wide.as_ptr(),
      target_wide.as_ptr(),
      MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
    )
  };
  if result == 0 {
    Err(io::Error::last_os_error())
  } else {
    Ok(())
  }
}

fn sync_parent(target: &Path) -> io::Result<()> {
  #[cfg(not(target_os = "windows"))]
  {
    let parent = target
      .parent()
      .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no parent directory"))?;
    File::open(parent)?.sync_all()?;
  }
  Ok(())
}

pub fn write_atomically(target: &Path, bytes: &[u8]) -> io::Result<()> {
  let parent = target
    .parent()
    .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "target has no parent directory"))?;
  fs::create_dir_all(parent)?;
  cleanup_stale_temporary_files(parent)?;

  let (temp_path, mut temp_file) = create_temporary_file(target)?;
  let result = (|| {
    temp_file.write_all(bytes)?;
    temp_file.sync_all()?;
    if temp_file.metadata()?.len() != bytes.len() as u64 {
      return Err(io::Error::new(
        io::ErrorKind::WriteZero,
        "temporary file length does not match payload",
      ));
    }
    drop(temp_file);
    replace_file(&temp_path, target)?;
    sync_parent(target)
  })();

  if result.is_err() {
    let _ = fs::remove_file(&temp_path);
  }
  result
}

fn cleanup_stale_temporary_files(directory: &Path) -> io::Result<usize> {
  if !directory.exists() {
    return Ok(0);
  }
  let current_process_marker = format!("{TEMP_MARKER}{}-", std::process::id());
  let mut removed = 0;
  for entry in fs::read_dir(directory)? {
    let entry = entry?;
    if !entry.file_type()?.is_file() {
      continue;
    }
    let name = entry.file_name();
    let name = name.to_string_lossy();
    if name.contains(TEMP_MARKER)
      && !name.contains(&current_process_marker)
      && name.ends_with(".tmp")
    {
      fs::remove_file(entry.path())?;
      removed += 1;
    }
  }
  Ok(removed)
}

#[tauri::command]
pub async fn write_file_atomically(path: String, bytes: Vec<u8>) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || write_atomically(Path::new(&path), &bytes))
    .await
    .map_err(|error| error.to_string())?
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn test_directory(name: &str) -> PathBuf {
    let suffix = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("clock must be after epoch")
      .as_nanos();
    std::env::temp_dir().join(format!("zoeymind-{name}-{}-{suffix}", std::process::id()))
  }

  #[test]
  fn replaces_an_existing_file_only_after_payload_is_complete() {
    let directory = test_directory("atomic-replace");
    fs::create_dir_all(&directory).expect("create test directory");
    let target = directory.join("project.zmind");
    fs::write(&target, b"old complete bundle").expect("write old bundle");

    write_atomically(&target, b"new complete bundle").expect("atomic write");

    assert_eq!(fs::read(&target).expect("read target"), b"new complete bundle");
    assert_eq!(fs::read_dir(&directory).expect("read directory").count(), 1);
    fs::remove_dir_all(directory).expect("remove test directory");
  }

  #[test]
  fn failed_target_keeps_unrelated_files_and_leaves_no_temporary_file() {
    let directory = test_directory("atomic-failure");
    fs::create_dir_all(&directory).expect("create test directory");
    let target_directory = directory.join("project.zmind");
    fs::create_dir(&target_directory).expect("create conflicting directory");
    let sentinel = directory.join("keep.txt");
    fs::write(&sentinel, b"keep").expect("write sentinel");

    assert!(write_atomically(&target_directory, b"bundle").is_err());
    assert!(target_directory.is_dir());
    assert_eq!(fs::read(&sentinel).expect("read sentinel"), b"keep");
    assert_eq!(fs::read_dir(&directory).expect("read directory").count(), 2);
    fs::remove_dir_all(directory).expect("remove test directory");
  }

  #[test]
  fn cleanup_only_removes_zoeymind_temporary_files() {
    let directory = test_directory("atomic-cleanup");
    fs::create_dir_all(&directory).expect("create test directory");
    fs::write(directory.join(".project.zmind.zoeymind-write-1-1.tmp"), b"stale")
      .expect("write stale temp");
    fs::write(directory.join("user.tmp"), b"keep").expect("write user temp");

    assert_eq!(cleanup_stale_temporary_files(&directory).expect("cleanup"), 1);
    assert!(directory.join("user.tmp").exists());
    fs::remove_dir_all(directory).expect("remove test directory");
  }
}
