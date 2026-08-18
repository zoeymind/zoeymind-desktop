export declare const getSummaryText: (node: any, topicId: any) => any
export declare const getSummaryText2: (item: any, topicId: any) => any
export declare const getRoot: (list: any) => any
export declare const getItemByName: (arr: any, name: any) => any
export declare const getElementsByType: (arr: any, type: any) => any
export declare const addSummaryData: (
  selfList: any,
  childrenList: any,
  getText: any,
  range: any
) => void
export declare const handleNodeImageFromXmind: (
  node: any,
  newNode: any,
  promiseList: any,
  files: any
) => Promise<void>
export declare const handleNodeImageToXmind: (
  node: any,
  newData: any,
  promiseList: any,
  imageList: any
) => Promise<void>
export declare const getXmindContentXmlData: () => string
export declare const parseNodeGeneralizationToXmind: (node: any) => {
  summary: any[]
  summaries: any[]
}
