import { reportData as mockReportData } from "./mockReport";
import aiReplaySampleText from "./aiReplaySample.txt?raw";

const defaultHeroTags = [
  "Issue: truth did not become trust",
  "Risk: false consensus locked too fast",
  "Focus: rebuild the vote path",
];

const defaultJudgeNotes = [
  {
    label: "Key Finding",
    text: "Wolves did not win through one explosive move. They won by defining what the table should keep doubting.",
  },
  {
    label: "Village Error",
    text: "Correct information never became public proof, and the village side failed to build a correction loop in round two.",
  },
  {
    label: "Review Focus",
    text: "The review is not only about who was right, but about who controlled topic framing and side selection.",
  },
];

const sampleSpeechHistory = {
  Player1: [
    {
      label: "Day 1 · Speech",
      text: "I checked Player2 last night. Player2 should be good.",
    },
  ],
  Player2: [
    {
      label: "Day 1 · Speech",
      text: "Player1 spoke early and gave a clear result, I lean good on Player1.",
    },
  ],
  Player3: [
    {
      label: "Day 1 · Speech",
      text: "Player1's result is too smooth. I want to hear more before trusting it.",
    },
  ],
  Player4: [
    {
      label: "Day 1 · Speech",
      text: "Player3 is pushing too hard against the only check we have.",
    },
  ],
  Player6: [
    {
      label: "Day 1 · Speech",
      text: "If Player1 is true, the wolf may be hiding among quiet players.",
    },
  ],
};

function parseReplayText(rawText) {
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonData = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
  const prose = rawText.replace(/```json[\s\S]*?```/, "").trim();
  const paragraphs = prose
    .split(/\r?\n\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("###"));

  return { jsonData, paragraphs };
}

function normalizePlayerId(value) {
  if (!value) return value;
  if (/^Player/i.test(value)) return value;
  const match = String(value).match(/p(\d+)/i);
  return match ? `Player${match[1]}` : String(value);
}

function buildVoteRounds(voteAnalysis) {
  if (!voteAnalysis) return [];

  return Object.entries(voteAnalysis).map(([roundKey, roundValue], index) => {
    const voteChips = Object.entries(roundValue.vote_counts || {}).map(([playerId, count]) => {
      return `${normalizePlayerId(playerId)} ${count}票`;
    });

    return {
      round: `第 ${index + 1} 轮投票`,
      headline: roundValue.voted_out ? `${roundValue.voted_out} 被投出局` : "本轮未产生白天出局",
      summary:
        roundValue.anomaly && roundValue.anomaly !== "无异常票型"
          ? `${roundValue.analysis} 异常点：${roundValue.anomaly}`
          : roundValue.analysis,
      players: voteChips.length ? voteChips : ["无投票记录"],
      key: roundKey,
    };
  });
}

function buildSpeechIssues(issues) {
  if (!Array.isArray(issues) || !issues.length) return [];

  return issues.map((item, index) => ({
    player: item.player || `Player${index + 1}`,
    round: "待补充轮次",
    excerpt: item.issue || "待补充发言摘录",
    reason: item.reason || "待补充原因分析",
    history: sampleSpeechHistory[item.player] || [],
  }));
}

function buildOverview(parsed) {
  if (!parsed) return [];

  const primaryMistake = parsed.mistakes?.[1];
  const firstVote = parsed.vote_analysis?.round_1;
  const witchPlay = parsed.skill_evaluation?.find((item) => item.role === "女巫");

  return [
    {
      label: "胜利阵营",
      value: "好人获胜",
      note: "6人局样例中，好人通过投票与女巫毒药完成收尾",
      tone: "claret",
    },
    {
      label: "首轮出局",
      value: firstVote?.voted_out || "待补充",
      note: firstVote?.analysis || "待补充票型分析",
      tone: "forest",
    },
    {
      label: "关键技能",
      value: witchPlay ? witchPlay.actions.join(" / ") : "待补充",
      note: witchPlay?.evaluation || "待补充技能评估",
      tone: "moss",
    },
    {
      label: "核心失误",
      value: primaryMistake?.player || "待补充",
      note: primaryMistake?.mistake || "待补充失误总结",
      tone: "ember",
    },
  ];
}

function buildTimeline(paragraphs) {
  if (!paragraphs.length) return [];

  const stageLabels = ["开局", "中盘", "对抗", "终局"];
  const titles = [
    "预言家率先给出明确信息",
    "狼人通过质疑打乱信任链",
    "关键技能改变对局走向",
    "胜负在策略失误中收束",
  ];
  const icons = ["wb_twilight", "campaign", "local_fire_department", "nights_stay"];

  return paragraphs.slice(0, 4).map((detail, index) => ({
    stage: stageLabels[index] || `阶段 ${index + 1}`,
    title: titles[index] || `关键节点 ${index + 1}`,
    detail,
    icon: icons[index] || "timeline",
  }));
}

function buildHeroTags(parsed) {
  if (!parsed) return defaultHeroTags;

  const tags = [];
  const wolfMistake = parsed.mistakes?.find((item) => String(item.player).includes("狼人"));
  const witchPlay = parsed.skill_evaluation?.find((item) => item.role === "女巫");
  const actionFocus = parsed.action_items?.[1];

  if (witchPlay) {
    tags.push(`Key play: ${witchPlay.actions.join(" / ")}`);
  }
  if (wolfMistake) {
    tags.push(`Risk: ${wolfMistake.mistake}`);
  }
  if (actionFocus) {
    tags.push(`Focus: ${actionFocus}`);
  }

  return tags.length ? tags : defaultHeroTags;
}

function buildJudgeNotes(parsed, paragraphs) {
  if (!parsed) return defaultJudgeNotes;

  return [
    {
      label: "Key Finding",
      text: paragraphs[0] || "待补充总结",
    },
    {
      label: "Major Mistake",
      text: parsed.mistakes?.[0]
        ? `${parsed.mistakes[0].player}：${parsed.mistakes[0].mistake}`
        : defaultJudgeNotes[1].text,
    },
    {
      label: "Review Focus",
      text: parsed.action_items?.[0] || defaultJudgeNotes[2].text,
    },
  ];
}

function buildMeta(baseMeta, paragraphs) {
  const intro = paragraphs[0] || "";
  const closing = paragraphs[paragraphs.length - 1] || baseMeta.narrator;
  const modeMatch = intro.match(/(\d+)人/);
  const winningCamp = intro.includes("好人阵营最终获胜")
    ? "好人阵营获胜"
    : intro.includes("狼人阵营最终获胜")
      ? "狼人阵营获胜"
      : baseMeta.winningCamp;

  return {
    ...baseMeta,
    gameId: "20260511_214012",
    mode: modeMatch ? `${modeMatch[1]} 人局` : baseMeta.mode,
    winningCamp,
    narrator: closing,
  };
}

function buildReportData(baseReport, replayText) {
  try {
    const { jsonData, paragraphs } = parseReplayText(replayText);

    return {
      ...baseReport,
      meta: buildMeta(baseReport.meta, paragraphs),
      overview: buildOverview(jsonData).length ? buildOverview(jsonData) : baseReport.overview,
      timeline: buildTimeline(paragraphs).length ? buildTimeline(paragraphs) : baseReport.timeline,
      voteRounds: buildVoteRounds(jsonData?.vote_analysis).length
        ? buildVoteRounds(jsonData.vote_analysis)
        : baseReport.voteRounds,
      speechIssues: buildSpeechIssues(jsonData?.speech_issues).length
        ? buildSpeechIssues(jsonData.speech_issues)
        : baseReport.speechIssues,
      strategyRecommendations:
        jsonData?.strategy_recommendations?.length
          ? jsonData.strategy_recommendations
          : baseReport.strategyRecommendations,
      actionItems: jsonData?.action_items?.length ? jsonData.action_items : baseReport.actionItems,
      heroTags: buildHeroTags(jsonData),
      judgeNotes: buildJudgeNotes(jsonData, paragraphs),
    };
  } catch (error) {
    console.error("Failed to parse AI replay sample, fallback to mock report.", error);
    return {
      ...baseReport,
      heroTags: defaultHeroTags,
      judgeNotes: defaultJudgeNotes,
    };
  }
}

export const reportData = buildReportData(mockReportData, aiReplaySampleText);
