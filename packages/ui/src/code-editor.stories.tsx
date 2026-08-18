import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { CodeEditor } from './code-editor'

const meta: Meta<typeof CodeEditor> = {
  title: 'Data/CodeEditor',
  component: CodeEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded' }
}

export default meta
type Story = StoryObj<typeof CodeEditor>

function Demo() {
  const [code, setCode] = useState(`def greet(name):\n    print(f"Hello, {name}")\n\ngreet("Zoey")`)
  return (
    <div className="w-[560px]">
      <CodeEditor value={code} onChange={setCode} language="python" height="220px" />
    </div>
  )
}

export const Python: Story = { render: () => <Demo /> }

export const ReadOnly: Story = {
  render: () => (
    <div className="w-[560px]">
      <CodeEditor
        value={'const answer = 42\nconsole.log(answer)'}
        language="javascript"
        readOnly
        height="140px"
      />
    </div>
  )
}
