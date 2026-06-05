<script setup lang="ts">
import { NModal } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Opportunity } from '@/data/presales-mock'

defineProps<{
  show: boolean
  opportunity: Opportunity | null
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()
const { t } = useI18n()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('presales.companyInsight.title')"
    style="width: min(880px, 96vw);"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="opportunity">
      <section class="section">
        <h4>{{ t('presales.companyInsight.basic') }}</h4>
        <ul>
          <li>{{ t('presales.companyInsight.registry') }}：{{ opportunity.companyName }}（存续）</li>
          <li>{{ t('presales.companyInsight.capital') }}：5000 万人民币</li>
          <li>{{ t('presales.companyInsight.scope') }}：软件开发、企业营销服务、数据咨询</li>
          <li>{{ t('presales.companyInsight.shareholders') }}：创始团队 62%，机构投资人 38%</li>
        </ul>
      </section>
      <section class="section">
        <h4>{{ t('presales.companyInsight.recent') }}</h4>
        <p>{{ opportunity.companyInsight }}</p>
        <ul>
          <li>发布新一轮产品路线图，重点投入 AI 售前能力</li>
          <li>华东区销售负责人到岗，拓展企业客户</li>
        </ul>
      </section>
      <section class="section">
        <h4>{{ t('presales.companyInsight.bidding') }}</h4>
        <ul>
          <li>2026-Q2 营销自动化平台采购项目（立项中）</li>
          <li>CRM 与线索评分模块联合招标（筹备阶段）</li>
        </ul>
      </section>
      <section class="section">
        <h4>{{ t('presales.companyInsight.potential') }}</h4>
        <ul>
          <li>{{ t('presales.companyInsight.pain') }}：方案产出慢、知识难复用</li>
          <li>{{ t('presales.companyInsight.tech') }}：需要 AI 文档生成与商机评分</li>
          <li>{{ t('presales.companyInsight.growth') }}：可通过标杆案例复制到 sibling 业务线</li>
        </ul>
      </section>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.section {
  margin-bottom: 18px;

  h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: $text-primary;
  }

  p, li {
    margin: 0 0 6px;
    font-size: 13px;
    color: $text-secondary;
    line-height: 1.6;
  }

  ul { margin: 0; padding-left: 18px; }
}
</style>
