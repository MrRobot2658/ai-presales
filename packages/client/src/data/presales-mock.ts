export type OpportunityStatus = 'new' | 'following' | 'won' | 'lost'

export interface Opportunity {
  id: string
  source: string
  companyName: string
  description: string
  industry: string
  contactName: string
  phone: string
  email: string
  position: string
  officeAddress: string
  hqLocation: string
  matchScore: number
  status: OpportunityStatus
  createdAt: string
  companyInsight: string
  contactActivities: string[]
}

export interface KnowledgeFile {
  id: string
  fileName: string
  fileType: string
  uploadedAt: string
  status: 'ready' | 'processing' | 'failed'
  cleanRequirement?: string
  eta?: string
}

export interface ContentDraft {
  id: string
  opportunityId: string
  companyName: string
  title: string
  scenario: string[]
  knowledgeRefs: string[]
  description: string
  status: 'generating' | 'draft' | 'editing' | 'completed'
  updatedAt: string
  htmlContent: string
  sections: { id: string; title: string; content: string }[]
  outputFile?: string
  outputFileAbs?: string
  outputDirectory?: string
  source?: 'draft' | 'imported'
}

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-1',
    source: '官网表单',
    companyName: '上海智云科技有限公司',
    description: '希望搭建 B2B 营销自动化平台，支持线索评分与多渠道触达。',
    industry: 'SaaS',
    contactName: '张明',
    phone: '13800138001',
    email: 'zhangming@zhiyun.com',
    position: '市场总监',
    officeAddress: '上海市浦东新区张江高科',
    hqLocation: '上海',
    matchScore: 92,
    status: 'following',
    createdAt: '2026-06-01',
    companyInsight: '近期完成 A 轮融资，正在扩张华东销售团队，对营销数字化投入意愿强。',
    contactActivities: [
      '浏览官网「营销自动化」产品页 42 秒',
      '打开「B2B 线索培育」营销短信',
      '下载《2026 B2B 增长白皮书》',
    ],
  },
  {
    id: 'opp-2',
    source: '行业峰会',
    companyName: '深圳前海数据服务有限公司',
    description: '需要数据中台与 AI 商机洞察能力，用于金融客户拓展。',
    industry: '金融科技',
    contactName: '李婷',
    phone: '13900139002',
    email: 'liting@qianhai-data.cn',
    position: '解决方案负责人',
    officeAddress: '深圳市南山区科技园',
    hqLocation: '深圳',
    matchScore: 88,
    status: 'following',
    createdAt: '2026-05-28',
    companyInsight: '中标多个城商行数字化项目，正在寻找可复用的售前方案工具。',
    contactActivities: [
      '观看产品演示回放 8 分钟',
      '浏览「金融行业案例」页面 65 秒',
    ],
  },
  {
    id: 'opp-3',
    source: '渠道推荐',
    companyName: '北京恒信制造集团',
    description: '计划上线经销商门户与招投标方案自动生成系统。',
    industry: '制造业',
    contactName: '王强',
    phone: '13700137003',
    email: 'wangqiang@hx-mfg.com',
    position: 'IT 总监',
    officeAddress: '北京市亦庄经济开发区',
    hqLocation: '北京',
    matchScore: 85,
    status: 'new',
    createdAt: '2026-06-03',
    companyInsight: '集团推进数字化采购，近期发布多个设备采购招标公告。',
    contactActivities: [
      '浏览官网「招投标方案」页面 30 秒',
      '打开渠道伙伴介绍邮件',
    ],
  },
  {
    id: 'opp-4',
    source: '广告投放',
    companyName: '杭州云栖教育科技',
    description: '希望用 AI 生成院校合作方案与招生宣传 PPT。',
    industry: '教育',
    contactName: '陈雪',
    phone: '13600136004',
    email: 'chenxue@yunqi-edu.com',
    position: '运营副总裁',
    officeAddress: '杭州市余杭区未来科技城',
    hqLocation: '杭州',
    matchScore: 79,
    status: 'following',
    createdAt: '2026-05-20',
    companyInsight: '新设 ToB 业务线，正在寻找可快速产出方案的工具。',
    contactActivities: ['打开「教育行业方案」营销短信', '浏览案例库 55 秒'],
  },
  {
    id: 'opp-5',
    source: '老客户转介绍',
    companyName: '成都锦城医疗健康',
    description: '需要患者旅程分析与智能随访方案生成能力。',
    industry: '医疗',
    contactName: '赵磊',
    phone: '13500135005',
    email: 'zhaolei@jincheng-health.com',
    position: '数字化部经理',
    officeAddress: '成都市高新区天府大道',
    hqLocation: '成都',
    matchScore: 76,
    status: 'new',
    createdAt: '2026-06-02',
    companyInsight: '与多家三甲医院共建智慧服务，预算充足。',
    contactActivities: ['浏览「医疗行业洞察」报告 2 分钟'],
  },
  {
    id: 'opp-6',
    source: '官网表单',
    companyName: '广州南越零售连锁',
    description: '会员运营与门店营销方案自动化需求。',
    industry: '零售',
    contactName: '刘洋',
    phone: '13400134006',
    email: 'liuyang@nanyue-retail.com',
    position: 'CMO',
    officeAddress: '广州市天河区珠江新城',
    hqLocation: '广州',
    matchScore: 71,
    status: 'following',
    createdAt: '2026-05-15',
    companyInsight: '门店数字化改造中，关注会员复购提升。',
    contactActivities: ['浏览「零售增长方案」页面 25 秒'],
  },
]

export const MOCK_KNOWLEDGE_FILES: KnowledgeFile[] = [
  {
    id: 'kb-1',
    fileName: 'B2B营销自动化产品手册.pdf',
    fileType: 'PDF',
    uploadedAt: '2026-05-10 14:20',
    status: 'ready',
  },
  {
    id: 'kb-2',
    fileName: '金融行业成功案例集.pptx',
    fileType: 'PPT',
    uploadedAt: '2026-05-18 09:45',
    status: 'ready',
  },
  {
    id: 'kb-3',
    fileName: '招投标标准模板.docx',
    fileType: 'Word',
    uploadedAt: '2026-05-25 16:30',
    status: 'ready',
  },
]

export const INDUSTRY_STATS = [
  { name: 'SaaS', value: 18 },
  { name: '金融科技', value: 14 },
  { name: '制造业', value: 12 },
  { name: '教育', value: 9 },
  { name: '医疗', value: 8 },
  { name: '零售', value: 7 },
]

export const REGION_STATS = [
  { name: '华东', value: 22 },
  { name: '华南', value: 16 },
  { name: '华北', value: 14 },
  { name: '西南', value: 8 },
  { name: '其他', value: 6 },
]

export const AI_SUGGESTIONS = [
  {
    priority: 'high' as const,
    count: 3,
    reason: '匹配分 ≥85 且 7 天内有高意向行为（下载白皮书/观看演示）',
  },
  {
    priority: 'medium' as const,
    count: 5,
    reason: '匹配分 70-84，建议 48 小时内电话跟进确认预算',
  },
  {
    priority: 'low' as const,
    count: 4,
    reason: '匹配分 <70 或长期无互动，可进入培育池',
  },
]

export const KNOWLEDGE_OPTIONS = [
  { label: 'B2B营销自动化产品手册.pdf', value: 'kb-1' },
  { label: '金融行业成功案例集.pptx', value: 'kb-2' },
  { label: '招投标标准模板.docx', value: 'kb-3' },
]

export const SCENARIO_OPTIONS = [
  { label: '招投标 Word 文件', value: 'bid-word' },
  { label: '产品介绍 PPT', value: 'product-ppt' },
  { label: '案例 PPT', value: 'case-ppt' },
]
