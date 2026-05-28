<script setup>
import { computed, onMounted } from "vue";
import { reportData, isLoading, loadError, loadReport } from "./data/reportAdapter";

const sectionNav = [
  { id: "overview", label: "总览", icon: "dashboard" },
  { id: "skills", label: "技能评估", icon: "auto_awesome" },
  { id: "evidence", label: "票型与发言", icon: "history_edu" },
  { id: "mistakes", label: "关键失误", icon: "warning" },
  { id: "recommendations", label: "策略建议", icon: "school" },
];

function goBack() {
  if (window.opener) {
    window.close();
  } else {
    window.history.back();
  }
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");
  if (gameId) {
    loadReport(gameId);
  }
});

const summaryParagraphs = computed(() => reportData.value.summaryParagraphs || []);
const heroTags = computed(() => reportData.value.heroTags || []);
const overview = computed(() => reportData.value.overview || []);
const voteRounds = computed(() => reportData.value.voteRounds || []);
const speechIssues = computed(() => reportData.value.speechIssues || []);
const skillEvaluations = computed(() => reportData.value.skillEvaluations || []);
const mistakes = computed(() => reportData.value.mistakes || []);
const strategyRecommendations = computed(() => reportData.value.strategyRecommendations || []);
</script>

<template>
  <div class="min-h-screen bg-parchment text-ink">
    <div
      v-if="isLoading"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-parchment/90 backdrop-blur-sm"
    >
      <p class="font-headline text-2xl font-bold italic text-forest mb-3">月夜审判</p>
      <p class="text-sm text-[#7f765f]">正在生成复盘报告，请稍候...</p>
    </div>
    <div v-if="loadError" class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] rounded-2xl bg-[#f5d0cc] px-6 py-3 text-[#8a1b1e] text-sm shadow">
      {{ loadError }}
    </div>
    <header
      class="fixed inset-x-0 top-0 z-50 border-b border-[#e8dfcf] bg-parchment/85 backdrop-blur-xl"
    >
      <div class="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
        <div class="flex items-center gap-8">
          <div>
            <p class="font-headline text-3xl font-extrabold italic text-forest">月夜审判</p>
            <p class="text-xs tracking-[0.28em] text-[#7f765f]">对局复盘与分析</p>
          </div>
        </div>
        <div class="flex items-center gap-3 text-sm text-[#746b57]">
          <span v-if="isLoading" class="rounded-full border border-[#d8cfbf] px-3 py-1 animate-pulse">分析中...</span>
          <span v-else class="rounded-full border border-[#d8cfbf] px-3 py-1">Game {{ reportData.meta.gameId }}</span>
          <button
            type="button"
            class="rounded-full bg-claret px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#7a0b15]"
            @click="goBack"
          >
            返回结算
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto flex max-w-[1500px] gap-8 px-4 pb-12 pt-24 md:px-8">
      <aside
        class="sticky top-24 hidden h-[calc(100vh-7rem)] w-72 shrink-0 rounded-[28px] bg-wheat p-6 shadow-vellum lg:flex lg:flex-col"
      >
        <div class="mb-8 border-b border-[#e5dbc9] pb-5">
          <p class="font-headline text-2xl font-bold italic text-claret">{{ reportData.meta.title }}</p>
          <p class="mt-2 text-sm leading-6 text-[#6f6754]">{{ reportData.meta.subtitle }}</p>
        </div>

        <nav class="flex-1 space-y-2">
          <a
            v-for="item in sectionNav"
            :key="item.id"
            :href="`#${item.id}`"
            class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-moss transition hover:bg-[#ece3d4] hover:text-claret"
          >
            <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </a>
        </nav>

        
      </aside>

      <div class="min-w-0 flex-1 space-y-8">
        <section
          id="overview"
          class="relative overflow-hidden rounded-[32px] border border-[#eadfce] bg-[radial-gradient(circle_at_top_left,_rgba(138,27,30,0.18),_transparent_32%),linear-gradient(135deg,_rgba(45,75,34,0.95),_rgba(99,0,10,0.88))] px-7 py-10 text-[#fff8ef] shadow-vellum md:px-10"
        >
          <div class="pointer-events-none absolute inset-0 bg-grain opacity-[0.07]"></div>
          <div class="relative grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <p class="text-sm uppercase tracking-[0.35em] text-[#f7dcc7]">{{ reportData.meta.mode }}</p>
              <h1 class="mt-4 font-headline text-5xl font-extrabold italic leading-tight">
                {{ reportData.meta.winningCamp }}
              </h1>
              <p class="mt-5 max-w-2xl text-lg leading-8 text-[#fff2e0]">
                {{ summaryParagraphs[0] || reportData.meta.narrator }}
              </p>
              <div class="mt-8 flex flex-wrap gap-3">
                <span
                  v-for="tag in heroTags"
                  :key="tag"
                  class="rounded-full bg-white/14 px-4 py-2 text-sm"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <div class="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <p class="text-sm uppercase tracking-[0.24em] text-[#ffe7d8]">案件摘要</p>
              <div class="mt-5 space-y-4">
                <div
                  v-for="item in overview"
                  :key="item.label"
                  class="rounded-[22px] bg-[#fffaf2]/10 p-4"
                >
                  <div class="flex items-center justify-between gap-4">
                    <p class="text-sm text-[#fff3e7]">{{ item.label }}</p>
                    <p class="font-headline text-2xl italic">{{ item.value }}</p>
                  </div>
                  <p class="mt-2 text-sm leading-6 text-[#f8eadc]">{{ item.note }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 独立的 AI 总览模块已隐藏，摘要信息保留在页面顶部的胜负总览中。 -->
        <section id="skills">
          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-[#6d3900]">auto_awesome</span>
              <h2 class="font-headline text-3xl font-bold italic text-[#6d3900]">技能评估</h2>
            </div>
            <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div
                v-for="skill in skillEvaluations"
                :key="`${skill.title}-${skill.detail}`"
                class="rounded-[22px] bg-parchment p-5"
              >
                <p class="font-headline text-xl font-bold text-[#513318]">{{ skill.title }}</p>
                <p class="mt-3 text-base leading-7 text-[#5c503d]">
                  {{ skill.detail }}
                </p>
              </div>
              <p v-if="!skillEvaluations.length" class="rounded-[22px] bg-parchment p-5 text-sm text-[#8a7b67] md:col-span-2 xl:col-span-3">
                本次报告未提供技能评估。
              </p>
            </div>
          </article>
        </section>

        <section id="evidence" class="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <article class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-forest">ballot</span>
              <h2 class="font-headline text-3xl font-bold italic text-forest">票型复盘</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div
                v-for="round in voteRounds"
                :key="round.round"
                class="rounded-[22px] bg-paper p-5"
              >
                <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p class="text-xs uppercase tracking-[0.24em] text-[#8a7b67]">{{ round.round }}</p>
                    <h3 class="mt-1 font-headline text-2xl font-bold text-ink">{{ round.headline }}</h3>
                  </div>
                  <div v-if="round.players.length" class="flex flex-wrap gap-2">
                    <span
                      v-for="player in round.players"
                      :key="player"
                      class="rounded-full border border-[#d9cfbf] px-3 py-1 text-sm text-[#635946]"
                    >
                      {{ player }}
                    </span>
                  </div>
                </div>
                <p v-if="round.voteSummary !== round.headline" class="mt-4 text-[15px] leading-7 text-[#5f5643]">
                  {{ round.voteSummary }}
                </p>
                <div v-if="round.anomaly" class="mt-4 rounded-[16px] bg-[#fbf2e5] px-4 py-3 text-[15px] leading-7 text-[#5f5643]">
                  <span class="mr-2 font-semibold text-claret">观察</span>{{ round.anomaly }}
                </div>
              </div>
              <p v-if="!voteRounds.length" class="rounded-[22px] bg-paper p-5 text-sm text-[#8a7b67]">
                本次报告未提供票型分析。
              </p>
            </div>
          </article>

          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-claret">record_voice_over</span>
              <h2 class="font-headline text-3xl font-bold italic text-claret">发言问题</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div
                v-for="issue in speechIssues"
                :key="`${issue.player}-${issue.issue}`"
                class="rounded-[22px] border border-[#e6dccc] bg-parchment p-5"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <span class="rounded-full bg-[#f5d0cc] px-3 py-1 text-xs font-semibold text-[#8a1b1e]">
                    {{ issue.player }}
                  </span>
                </div>
                <p class="mt-4 text-xs uppercase tracking-[0.2em] text-[#8a7b67]">识别到的问题</p>
                <p class="mt-3 border-l-2 border-[#d6c5b7] pl-4 text-[16px] leading-8 text-[#513318]">
                  {{ issue.issue }}
                </p>
                <p v-if="issue.reason" class="mt-4 text-[15px] leading-7 text-[#5f5643]">{{ issue.reason }}</p>
              </div>
              <p v-if="!speechIssues.length" class="rounded-[22px] bg-parchment p-5 text-sm text-[#8a7b67]">
                本次报告未标记发言问题。
              </p>
            </div>
          </article>
        </section>

        <section id="mistakes" class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[28px] text-claret">warning</span>
            <h2 class="font-headline text-3xl font-bold italic text-claret">关键失误</h2>
          </div>
          <div class="mt-8 grid gap-4 md:grid-cols-2">
            <article
              v-for="(mistake, index) in mistakes"
              :key="`${mistake.title}-${mistake.detail}`"
              class="flex gap-4 rounded-[22px] bg-paper p-5"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5d0cc] text-sm font-semibold text-claret">
                {{ index + 1 }}
              </span>
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-[#8a7b67]">{{ mistake.title }}</p>
                <p class="mt-2 text-[15px] leading-7 text-[#5f5643]">{{ mistake.detail }}</p>
              </div>
            </article>
            <p v-if="!mistakes.length" class="rounded-[22px] bg-paper p-5 text-sm text-[#8a7b67]">
              本次报告未标记关键失误。
            </p>
          </div>
        </section>

        <section id="recommendations">
          <article class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-[#6d3900]">school</span>
              <h2 class="font-headline text-3xl font-bold italic text-[#6d3900]">策略建议</h2>
            </div>
            <div class="mt-8 grid gap-4 md:grid-cols-2">
              <div
                v-for="item in strategyRecommendations"
                :key="item"
                class="rounded-[22px] bg-paper p-5"
              >
                <p class="text-[15px] leading-7 text-[#5f5643]">{{ item }}</p>
              </div>
              <p v-if="!strategyRecommendations.length" class="rounded-[22px] bg-paper p-5 text-sm text-[#8a7b67] md:col-span-2">
                本次报告未提供策略建议。
              </p>
            </div>
          </article>
          <!-- 行动项模块已按当前复盘页面展示需求隐藏。 -->
        </section>
      </div>
    </main>

    <footer class="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7dece] bg-parchment/90 backdrop-blur lg:hidden">
      <div class="flex items-center justify-around px-4 py-3">
        <a
          v-for="item in sectionNav"
          :key="item.id"
          :href="`#${item.id}`"
          class="flex flex-col items-center gap-1 text-[#5f5643]"
        >
          <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
          <span class="text-[11px]">{{ item.label }}</span>
        </a>
      </div>
    </footer>
  </div>
</template>
