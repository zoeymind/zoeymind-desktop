import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { PreviewMedia, type MediaItem } from './preview-media'

const meta: Meta<typeof PreviewMedia> = {
  title: 'Data/PreviewMedia',
  component: PreviewMedia,
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof PreviewMedia>

// 内联 SVG data URI —— story 页面不依赖外网
const svg = (label: string, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'>
       <rect width='100%' height='100%' fill='hsl(${hue} 60% 70%)'/>
       <text x='50%' y='55%' text-anchor='middle' font-family='sans-serif' font-size='40' fill='white'>${label}</text>
     </svg>`
  )}`

const INITIAL: MediaItem[] = [
  { id: '1', name: 'hero.png', url: svg('IMG', 210), type: 'image' },
  { id: '2', name: 'brief.pdf', type: 'file' },
  { id: '3', name: 'notes.md', type: 'file' }
]

function Demo(props: { size?: 'sm' | 'md' | 'lg' }) {
  const [items, setItems] = useState(INITIAL)
  return (
    <div className="w-96">
      <PreviewMedia
        items={items}
        size={props.size}
        onRemove={index => setItems(prev => prev.filter((_, i) => i !== index))}
      />
    </div>
  )
}

export const Medium: Story = { render: () => <Demo /> }
export const Small: Story = { render: () => <Demo size="sm" /> }
export const Large: Story = { render: () => <Demo size="lg" /> }
