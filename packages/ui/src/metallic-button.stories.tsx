import type { Meta, StoryObj } from "@storybook/react";
import { SparklesIcon } from "lucide-react";

import { MetallicButton } from "./metallic-button";

const meta: Meta<typeof MetallicButton> = {
  title: "Primitives/MetallicButton",
  component: MetallicButton,
  tags: ["autodocs"],
  args: {
    children: "Zoey Agent",
  },
};

export default meta;
type Story = StoryObj<typeof MetallicButton>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <SparklesIcon data-icon="inline-start" />
        Zoey Agent
      </>
    ),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
