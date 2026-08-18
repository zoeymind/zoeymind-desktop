/**
 * 思维导图节点数量上限
 */
export const MAX_NODE_COUNT = 5000

/**
 * 默认思维导图数据
 *
 * 注意：所有 uid 必须是标准 UUID v4 格式（小写十六进制 + 连字符），
 * 因为前端 ZTDL mention 渲染的正则仅匹配 [a-f0-9-]+ 格式。
 */
export const defaultMindmapData = {
  data: {
    text: 'XX模块', // 更新了中心主题名称
    expand: true,
    uid: '5e0425e1-29d6-4870-91ed-cb2322ff532c'
  },
  children: [
    {
      data: {
        text: '核心模块A',
        icon: ['sign_2'],
        uid: '133a9b25-1a23-4a62-9747-d26613c75b06'
      },
      children: [
        {
          data: {
            text: '测试标题1 & 前置条件1',
            icon: ['priority_1'],
            uid: '19024810-88d0-4d9c-9a4e-c01be5282486'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: '04c3ac38-2e37-4dae-9108-a8861d616aa3' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: '7ea43a4a-6eb0-4b6d-b8b2-e14273aeebaa' },
              children: []
            }
          ]
        },
        {
          data: {
            text: '测试标题2 & 前置条件2',
            icon: ['priority_2'],
            uid: 'cf396fc2-f89f-43d6-bd0d-c59ab0e09d37'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: '5b4b79b5-6770-4c10-a90e-0b29d5090bc4' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: '44042b3b-247b-4778-9d70-cc08f611537c' },
              children: []
            }
          ]
        }
      ]
    },
    {
      data: {
        text: '核心模块B',
        icon: ['sign_2'],
        uid: '6bef2cdc-c1ed-492c-85d1-f5605175cd6b'
      },
      children: [
        {
          data: {
            text: '测试标题1 & 前置条件1',
            icon: ['priority_1'],
            uid: 'a9699924-584a-4e99-a93e-129724d60e30'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: '749425cd-779f-4961-a706-33a7a942f2ed' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: '152582e7-660c-415b-8907-b913ed107f25' },
              children: []
            }
          ]
        },
        {
          data: {
            text: '测试标题2 & 前置条件2',
            icon: ['priority_2'],
            uid: 'd5850e95-4882-4601-9959-2cda7248ee9b'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: '1f1672cc-1a7d-44e0-ad42-5e8d829d5300' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: '0e0aab1f-0b99-4cdc-9afb-a00bbed7106c' },
              children: []
            }
          ]
        }
      ]
    },
    {
      data: {
        text: '核心模块C',
        icon: ['sign_2'],
        uid: '1036b436-cc39-4f9c-ba3b-97347e925559'
      },
      children: [
        {
          data: {
            text: '测试标题1 & 前置条件1',
            icon: ['priority_1'],
            uid: '52fc7176-c8b2-4250-80af-89f31eb57a98'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: 'ddde8a69-5638-445d-96d7-29dc2df5033b' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: 'f62ac142-acd0-49f9-b5aa-fd8769bc9a8c' },
              children: []
            }
          ]
        },
        {
          data: {
            text: '测试标题2 & 前置条件2',
            icon: ['priority_2'],
            uid: '82e08d0d-752a-40c3-bdd1-56f7c69fc63d'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' },
              children: []
            }
          ]
        }
      ]
    },
    {
      data: {
        text: '核心模块D',
        icon: ['sign_2'],
        uid: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'
      },
      children: [
        {
          data: {
            text: '测试标题1 & 前置条件1',
            icon: ['priority_1'],
            uid: 'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: 'e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: 'f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c' },
              children: []
            }
          ]
        },
        {
          data: {
            text: '测试标题2 & 前置条件2',
            icon: ['priority_2'],
            uid: 'a7b8c9d0-e1f2-4a3b-4c5d-6e7f8a9b0c1d'
          },
          children: [
            {
              data: { text: '步骤1 & 预期1', uid: 'b8c9d0e1-f2a3-4b4c-5d6e-7f8a9b0c1d2e' },
              children: []
            },
            {
              data: { text: '步骤2 & 预期2', uid: 'c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f' },
              children: []
            }
          ]
        }
      ]
    }
  ]
}
