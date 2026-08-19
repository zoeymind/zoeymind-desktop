!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\ZoeyMind Document\DefaultIcon" "" "$\"$INSTDIR\zoeymind-document.ico$\",0"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\ZoeyMind Document\DefaultIcon"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
