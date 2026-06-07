<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { usePresalesStore } from '@/stores/presales'
import { AI_SUGGESTIONS, INDUSTRY_STATS, REGION_STATS } from '@/data/presales-mock'

const { t } = useI18n()
const router = useRouter()
const store = usePresalesStore()
const showAllRanking = ref(false)

onMounted(() => {
  void store.fetchOpportunities()
})

const ranking = () => showAllRanking.value
  ? [...store.opportunities].sort((a, b) => b.matchScore - a.matchScore)
  : store.rankingTop5

function priorityType(p: string) {
  if (p === 'high') return 'error'
  if (p === 'medium') return 'warning'
  return 'default'
}
</script>

<template>
  <div class="presales-page">
    <header class="page-hero">
      <span class="page-eyebrow">{{ t('presales.page.eyebrow') }}</span>
      <h2>{{ t('presales.overview.title') }}</h2>
      <p class="page-subtitle">{{ t('presales.overview.subtitle') }}</p>
    </header>

    <div class="stat-grid">
      <div class="stat-card">
        <span class="label">{{ t('presales.overview.total') }}</span>
        <strong>{{ store.totalCount }}</strong>
      </div>
      <div class="stat-card">
        <span class="label">{{ t('presales.overview.newMonth') }}</span>
        <strong>{{ store.newThisMonth }}</strong>
      </div>
      <div class="stat-card">
        <span class="label">{{ t('presales.overview.following') }}</span>
        <strong>{{ store.inProgressCount }}</strong>
      </div>
    </div>

    <div class="panel-grid">
      <section class="panel">
        <div class="panel-head">
          <h3>{{ t('presales.overview.ranking') }}</h3>
          <NButton text type="primary" @click="showAllRanking = !showAllRanking">
            {{ showAllRanking ? t('presales.overview.showTop5') : t('presales.overview.viewAll') }}
          </NButton>
        </div>
        <div v-for="(item, idx) in ranking()" :key="item.id" class="rank-row">
          <span class="rank-no">{{ idx + 1 }}</span>
          <div class="rank-main">
            <strong>{{ item.companyName }}</strong>
            <span>{{ item.contactName }} · {{ item.industry }}</span>
          </div>
          <NTag type="success" size="small">{{ item.matchScore }}</NTag>
        </div>
      </section>

      <section class="panel">
        <h3>{{ t('presales.overview.suggestions') }}</h3>
        <div v-for="item in AI_SUGGESTIONS" :key="item.priority" class="suggest-row">
          <div class="suggest-head">
            <NTag :type="priorityType(item.priority)" size="small">
              {{ t(`presales.priority.${item.priority}`) }}
            </NTag>
            <strong>{{ item.count }} {{ t('presales.overview.items') }}</strong>
          </div>
          <p>{{ item.reason }}</p>
        </div>
      </section>
    </div>

    <div class="panel-grid">
      <section class="panel">
        <h3>{{ t('presales.overview.industry') }}</h3>
        <div v-for="item in INDUSTRY_STATS" :key="item.name" class="bar-row">
          <span>{{ item.name }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: `${item.value * 3}%` }" /></div>
          <span>{{ item.value }}</span>
        </div>
      </section>
      <section class="panel">
        <h3>{{ t('presales.overview.region') }}</h3>
        <div v-for="item in REGION_STATS" :key="item.name" class="bar-row">
          <span>{{ item.name }}</span>
          <div class="bar-track"><div class="bar-fill region" :style="{ width: `${item.value * 3}%` }" /></div>
          <span>{{ item.value }}</span>
        </div>
      </section>
    </div>

    <div class="footer-actions">
      <NButton type="primary" @click="router.push({ name: 'presales.opportunities' })">
        {{ t('presales.overview.goList') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/presales-page.scss';
</style>
