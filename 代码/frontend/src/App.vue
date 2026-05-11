<script setup>
import { computed } from "vue";
import { reportData } from "./data/mockReport";

const metricLabels = {
  cognitiveConsistency: "Consistency",
  stressResponse: "Pressure",
  strategyPurity: "Strategy",
  expressiveness: "Expression",
  deceptionScore: "Deception",
};

const sectionNav = [
  { id: "overview", label: "总览", icon: "dashboard" },
  { id: "timeline", label: "时间线", icon: "timeline" },
  { id: "evidence", label: "关键证据", icon: "history_edu" },
  { id: "players", label: "玩家画像", icon: "groups" },
  { id: "network", label: "关系网络", icon: "share" },
  { id: "actions", label: "行动建议", icon: "task_alt" },
];

const highlightedPlayers = computed(() =>
  reportData.players.map((player) => {
    const riskLevel = Math.round(player.metrics.deceptionScore * 100);
    return {
      ...player,
      riskLevel,
      bars: Object.entries(player.metrics).map(([key, value]) => ({
        key,
        label: metricLabels[key] || key,
        value,
      })),
    };
  }),
);

function metricTone(key, value) {
  if (key === "deceptionScore") {
    return value > 0.7 ? "bg-claret" : "bg-[#d8b0b1]";
  }
  if (value > 0.75) return "bg-forest";
  if (value > 0.55) return "bg-moss";
  return "bg-[#b8a48a]";
}

function relationTone(type) {
  if (type === "ally") return "bg-[#f0d9be] text-[#6d3900]";
  if (type === "suspect") return "bg-[#f5d0cc] text-[#8a1b1e]";
  return "bg-[#dfe8c7] text-[#40521f]";
}

function roleTone(roleKey) {
  if (roleKey === "werewolf") return "bg-claret text-white";
  if (roleKey === "seer") return "bg-[#efe1c7] text-[#6d3900]";
  return "bg-[#dde5cc] text-[#3d4c1d]";
}
</script>

<template>
  <div class="min-h-screen bg-parchment text-ink">
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
          <span class="rounded-full border border-[#d8cfbf] px-3 py-1">Game {{ reportData.meta.gameId }}</span>
          <a
            href="/"
            class="rounded-full bg-claret px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#7a0b15]"
          >
            返回大厅
          </a>
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

        <div class="rounded-[24px] bg-paper p-5">
          <p class="text-xs uppercase tracking-[0.24em] text-[#8a7b67]">Verdict</p>
          <p class="mt-3 font-headline text-xl italic leading-8 text-[#513318]">
            {{ reportData.meta.narrator }}
          </p>
        </div>
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
                {{ reportData.meta.narrator }}
              </p>
              <div class="mt-8 flex flex-wrap gap-3">
                <span class="rounded-full bg-white/14 px-4 py-2 text-sm">Issue: truth did not become trust</span>
                <span class="rounded-full bg-white/14 px-4 py-2 text-sm">Risk: false consensus locked too fast</span>
                <span class="rounded-full bg-white/14 px-4 py-2 text-sm">Focus: rebuild the vote path</span>
              </div>
            </div>

            <div class="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <p class="text-sm uppercase tracking-[0.24em] text-[#ffe7d8]">案件摘要</p>
              <div class="mt-5 space-y-4">
                <div
                  v-for="item in reportData.overview"
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

        <section class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="item in reportData.overview"
            :key="item.label"
            class="rounded-[26px] border border-[#eadfce] bg-wheat p-6 shadow-vellum"
          >
            <p class="text-sm text-[#7e735f]">{{ item.label }}</p>
            <p class="mt-3 font-headline text-3xl font-bold italic text-claret">{{ item.value }}</p>
            <p class="mt-3 text-sm leading-6 text-[#615844]">{{ item.note }}</p>
          </article>
        </section>

        <section id="timeline" class="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <article class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-claret">timeline</span>
              <h2 class="font-headline text-3xl font-bold italic text-claret">关键转折点</h2>
            </div>
            <div class="relative mt-10 space-y-9 border-l-2 border-[#d8cfbf] pl-7">
              <div v-for="item in reportData.timeline" :key="item.title" class="relative">
                <div
                  class="absolute -left-[2.05rem] top-1 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-claret shadow-sm"
                >
                  <span class="material-symbols-outlined text-[20px]">{{ item.icon }}</span>
                </div>
                <p class="text-xs uppercase tracking-[0.28em] text-[#8d7d67]">{{ item.stage }}</p>
                <h3 class="mt-2 font-headline text-2xl font-bold text-ink">{{ item.title }}</h3>
                <p class="mt-3 max-w-2xl text-[15px] leading-7 text-[#5f5643]">{{ item.detail }}</p>
              </div>
            </div>
          </article>

          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-[#6d3900]">visibility</span>
              <h2 class="font-headline text-3xl font-bold italic text-[#6d3900]">Judge Notes</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div class="rounded-[22px] bg-parchment p-5">
                <p class="text-xs uppercase tracking-[0.22em] text-[#8a7b67]">Key Finding</p>
                <p class="mt-3 text-base leading-7 text-[#5c503d]">
                  Wolves did not win through one explosive move. They won by defining what the table should keep doubting.
                </p>
              </div>
              <div class="rounded-[22px] bg-parchment p-5">
                <p class="text-xs uppercase tracking-[0.22em] text-[#8a7b67]">Village Error</p>
                <p class="mt-3 text-base leading-7 text-[#5c503d]">
                  Correct information never became public proof, and the village side failed to build a correction loop in round two.
                </p>
              </div>
              <div class="rounded-[22px] bg-parchment p-5">
                <p class="text-xs uppercase tracking-[0.22em] text-[#8a7b67]">Review Focus</p>
                <p class="mt-3 text-base leading-7 text-[#5c503d]">
                  The review is not only about who was right, but about who controlled topic framing and side selection.
                </p>
              </div>
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
                v-for="round in reportData.voteRounds"
                :key="round.round"
                class="rounded-[22px] bg-paper p-5"
              >
                <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p class="text-xs uppercase tracking-[0.24em] text-[#8a7b67]">{{ round.round }}</p>
                    <h3 class="mt-1 font-headline text-2xl font-bold text-ink">{{ round.headline }}</h3>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="player in round.players"
                      :key="player"
                      class="rounded-full border border-[#d9cfbf] px-3 py-1 text-sm text-[#635946]"
                    >
                      {{ player }}
                    </span>
                  </div>
                </div>
                <p class="mt-4 text-[15px] leading-7 text-[#5f5643]">{{ round.summary }}</p>
              </div>
            </div>
          </article>

          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-claret">record_voice_over</span>
              <h2 class="font-headline text-3xl font-bold italic text-claret">Speech Clips</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div
                v-for="issue in reportData.speechIssues"
                :key="`${issue.player}-${issue.round}`"
                class="rounded-[22px] border border-[#e6dccc] bg-parchment p-5"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <span class="rounded-full bg-[#f5d0cc] px-3 py-1 text-xs font-semibold text-[#8a1b1e]">
                    {{ issue.player }}
                  </span>
                  <span class="text-sm text-[#7c715c]">{{ issue.round }}</span>
                </div>
                <p class="mt-4 border-l-2 border-[#d6c5b7] pl-4 font-headline text-xl italic leading-8 text-[#513318]">
                  "{{ issue.excerpt }}"
                </p>
                <p class="mt-4 text-[15px] leading-7 text-[#5f5643]">{{ issue.reason }}</p>
              </div>
            </div>
          </article>
        </section>

        <section id="players" class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[28px] text-[#6d3900]">auto_stories</span>
            <h2 class="font-headline text-3xl font-bold italic text-[#6d3900]">玩家画像</h2>
          </div>
          <div class="mt-8 grid gap-6 xl:grid-cols-2">
            <article
              v-for="player in highlightedPlayers"
              :key="player.id"
              class="rounded-[24px] bg-paper p-6"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div class="flex items-center gap-3">
                    <h3 class="font-headline text-3xl font-bold italic text-ink">{{ player.id }}</h3>
                    <span :class="['rounded-full px-3 py-1 text-xs font-semibold', roleTone(player.roleKey)]">
                      {{ player.role }}
                    </span>
                  </div>
                  <p class="mt-3 text-[15px] leading-7 text-[#5f5643]">{{ player.summary }}</p>
                </div>
                <div class="rounded-[18px] bg-parchment px-4 py-3 text-right">
                  <p class="text-xs uppercase tracking-[0.22em] text-[#8a7b67]">Risk</p>
                  <p class="font-headline text-3xl italic text-claret">{{ player.riskLevel }}%</p>
                </div>
              </div>

              <div class="mt-6 space-y-4">
                <div v-for="bar in player.bars" :key="bar.key">
                  <div class="flex items-center justify-between text-sm text-[#594f3d]">
                    <span>{{ bar.label }}</span>
                    <span>{{ Math.round(bar.value * 100) }}%</span>
                  </div>
                  <div class="mt-2 h-2.5 rounded-full bg-[#e7dece]">
                    <div
                      :class="['h-2.5 rounded-full transition-all', metricTone(bar.key, bar.value)]"
                      :style="{ width: `${Math.round(bar.value * 100)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="network" class="grid gap-8 xl:grid-cols-[0.8fr_1.2fr]">
          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-forest">hub</span>
              <h2 class="font-headline text-3xl font-bold italic text-forest">Relation Reading</h2>
            </div>
            <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div class="rounded-[22px] bg-parchment p-5">
                <p class="text-xs uppercase tracking-[0.24em] text-[#8a7b67]">Average Trust</p>
                <p class="mt-2 font-headline text-4xl italic text-forest">{{ reportData.network.avgTrust }}</p>
              </div>
              <div class="rounded-[22px] bg-parchment p-5">
                <p class="text-xs uppercase tracking-[0.24em] text-[#8a7b67]">Echo Chambers</p>
                <p class="mt-2 font-headline text-4xl italic text-claret">{{ reportData.network.echoChambers }}</p>
              </div>
            </div>
            <p class="mt-6 text-[15px] leading-7 text-[#5f5643]">{{ reportData.network.interpretation }}</p>
          </article>

          <article class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-claret">share</span>
              <h2 class="font-headline text-3xl font-bold italic text-claret">Network Ledger</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div
                v-for="link in reportData.network.links"
                :key="`${link.source}-${link.target}-${link.type}`"
                class="rounded-[22px] bg-paper p-5"
              >
                <div class="flex flex-wrap items-center gap-3">
                  <span class="font-headline text-2xl italic text-ink">{{ link.source }}</span>
                  <span class="text-[#807660]">-&gt;</span>
                  <span class="font-headline text-2xl italic text-ink">{{ link.target }}</span>
                  <span :class="['rounded-full px-3 py-1 text-xs font-semibold', relationTone(link.type)]">
                    {{ link.type }}
                  </span>
                </div>
                <p class="mt-4 text-[15px] leading-7 text-[#5f5643]">{{ link.note }}</p>
              </div>
            </div>
          </article>
        </section>

        <section id="actions" class="grid gap-8 xl:grid-cols-[1fr_1fr]">
          <article class="rounded-[28px] border border-[#eadfce] bg-wheat p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-[#6d3900]">school</span>
              <h2 class="font-headline text-3xl font-bold italic text-[#6d3900]">Recommendations</h2>
            </div>
            <div class="mt-8 space-y-4">
              <div
                v-for="item in reportData.strategyRecommendations"
                :key="item"
                class="rounded-[22px] bg-paper p-5"
              >
                <p class="text-[15px] leading-7 text-[#5f5643]">{{ item }}</p>
              </div>
            </div>
          </article>

          <article class="rounded-[28px] border border-[#eadfce] bg-paper p-7 shadow-vellum md:p-9">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[28px] text-forest">task_alt</span>
              <h2 class="font-headline text-3xl font-bold italic text-forest">Action Checklist</h2>
            </div>
            <div class="mt-8 space-y-4">
              <label
                v-for="item in reportData.actionItems"
                :key="item"
                class="flex gap-4 rounded-[22px] bg-parchment p-5"
              >
                <input type="checkbox" class="mt-1 h-5 w-5 rounded border-[#cbbda9] text-forest focus:ring-forest" />
                <span class="text-[15px] leading-7 text-[#5f5643]">{{ item }}</span>
              </label>
            </div>
          </article>
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
