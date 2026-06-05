<script setup lang="ts">
import { NModal, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { Opportunity } from '@/data/presales-mock'

defineProps<{
  show: boolean
  opportunity: Opportunity | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  openCompany: []
}>()

const { t } = useI18n()
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="t('presales.insight.title')"
    style="width: min(920px, 96vw);"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="opportunity">
      <div class="insight-header">
        <div>
          <h3>{{ opportunity.contactName }} · {{ opportunity.position }}</h3>
          <p>{{ opportunity.companyName }} · {{ opportunity.phone }} · {{ opportunity.email }}</p>
        </div>
        <div class="score-box">
          <span class="score">{{ opportunity.matchScore }}</span>
          <span>{{ t('presales.insight.matchScore') }}</span>
        </div>
      </div>

      <div class="insight-actions">
        <NButton type="primary" ghost @click="emit('openCompany')">
          {{ t('presales.insight.companyInsight') }}
        </NButton>
      </div>

      <section class="block">
        <h4>{{ t('presales.insight.leadDetail') }}</h4>
        <div class="lead-card">
          <img src="/logo.png" alt="" class="lead-img" />
          <div>
            <p><strong>{{ t('presales.fields.source') }}：</strong>{{ opportunity.source }}</p>
            <p><strong>{{ t('presales.fields.description') }}：</strong>{{ opportunity.description }}</p>
            <p><strong>{{ t('presales.fields.industry') }}：</strong>{{ opportunity.industry }}</p>
            <p><strong>{{ t('presales.fields.officeAddress') }}：</strong>{{ opportunity.officeAddress }}</p>
          </div>
        </div>
      </section>

      <section class="block">
        <h4>{{ t('presales.insight.contactActivity') }}</h4>
        <ul>
          <li v-for="(item, idx) in opportunity.contactActivities" :key="idx">{{ item }}</li>
        </ul>
      </section>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.insight-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;

  h3 { margin: 0 0 6px; color: $text-primary; }
  p { margin: 0; color: $text-secondary; font-size: 13px; }
}

.score-box {
  text-align: center;
  min-width: 88px;

  .score {
    display: block;
    font-size: 32px;
    font-weight: 700;
    color: $accent-primary;
    line-height: 1;
  }

  span:last-child { font-size: 12px; color: $text-muted; }
}

.insight-actions { margin-bottom: 16px; }

.block {
  margin-top: 16px;

  h4 { margin: 0 0 10px; color: $text-primary; font-size: 14px; }
  ul { margin: 0; padding-left: 18px; color: $text-secondary; }
}

.lead-card {
  display: flex;
  gap: 14px;
  padding: 14px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;

  p { margin: 0 0 6px; font-size: 13px; color: $text-secondary; }
}

.lead-img {
  width: 120px;
  height: 80px;
  object-fit: contain;
  object-position: left center;
  border-radius: $radius-sm;
  background: #fff;
}
</style>
