import { ref } from "vue";
import { reportData as mockReportData } from "./mockReport";
import aiReplaySampleText from "./aiReplaySample.txt?raw";

const sectionAliases = {
  "总览": "summary",
  "票型分析": "votes",
  "发言问题": "speech",
  "技能评估": "skills",
  "关键失误": "mistakes",
  "策略建议": "recommendations",
  "行动项": "actions",
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractFencedJson(rawText) {
  const match = rawText.match(/```json\s*([\s\S]*?)\s*```/i);
  return match ? parseJson(match[1]) : null;
}

function extractSections(rawText) {
  const withoutJson = rawText.replace(/```json[\s\S]*?```/gi, "");
  const lines = withoutJson.split(/\r?\n/);
  const sections = {};
  let activeKey = null;

  lines.forEach((line) => {
    const title = line.trim().replace(/^#{1,6}\s*/, "").trim();
    if (sectionAliases[title]) {
      activeKey = sectionAliases[title];
      sections[activeKey] = [];
      return;
    }
    if (activeKey && !/^\s*[-=]{2,}\s*$/.test(line)) {
      sections[activeKey].push(line);
    }
  });

  return Object.fromEntries(
    Object.entries(sections).map(([key, linesInSection]) => [key, linesInSection.join("\n").trim()]),
  );
}

function nonEmptyLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listLines(value) {
  return nonEmptyLines(value).map((line) => line.replace(/^[-*]\s*/, "").trim());
}

function splitParagraphs(value) {
  return String(value || "")
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function findNarrative(rawText) {
  const prose = rawText.replace(/```json[\s\S]*?```/gi, "").trim();
  return prose.replace(/^#{1,6}\s+.*(?:\r?\n)+/, "").trim();
}

function normalizePlayerId(value) {
  if (!value) return value;
  if (/^Player/i.test(value)) return value;
  const match = String(value).match(/p(\d+)/i);
  return match ? `Player${match[1]}` : String(value);
}

function parseVoteChips(summary) {
  if (!summary || summary.includes("弃票") || summary.includes("无人")) return [];
  return summary
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter((item) => /\d+\s*(?:获|获得)?\s*\d+\s*票/.test(item));
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function formatGeneralKey(key) {
  const labelMap = {
    player: "玩家",
    target: "对象",
    role: "角色",
    phase_or_round: "阶段",
    round: "轮次",
    day: "天数",
    issue: "问题",
    problem: "问题",
    action: "行动",
    evaluation: "评价",
    evidence: "依据",
    impact: "影响",
    reason: "原因",
    consequence: "后果",
    better_action: "更优做法",
    expected_gain: "预期收益",
    owner: "负责人",
    task: "任务",
    basis: "依据",
    deliverable: "产出",
  };
  return labelMap[key] || formatSkillDetailKey(key);
}

function formatGeneralValue(value) {
  if (!isPresent(value)) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(formatGeneralValue).filter(Boolean).join("；");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, entryValue]) => isPresent(entryValue))
      .map(([entryKey, entryValue]) => `${formatGeneralKey(entryKey)}：${formatGeneralValue(entryValue)}`)
      .join("；");
  }
  return String(value);
}

function toDetailRows(item, keys) {
  return keys
    .map((key) => ({
      key,
      label: formatGeneralKey(key),
      value: formatGeneralValue(item?.[key]),
    }))
    .filter((row) => row.value);
}

function getRoundLabel(roundKey, index, suffix = "投票") {
  const dayMatch = String(roundKey).match(/day[_-]?(\d+)/i);
  if (dayMatch) return `第${dayMatch[1]}天${suffix}`;
  const nightMatch = String(roundKey).match(/night[_-]?(\d+)/i);
  if (nightMatch) return `第${nightMatch[1]}夜${suffix}`;
  const numberMatch = String(roundKey).match(/(\d+)/);
  return `第 ${numberMatch?.[1] || index + 1} 轮${suffix}`;
}

function getVoteRoundLabel(roundKey, roundValue, index) {
  const explicitRound = roundValue?.round ?? roundValue?.round_number ?? roundValue?.roundNo ?? roundValue?.day;
  if (explicitRound !== undefined && explicitRound !== null && explicitRound !== "") {
    return getRoundLabel(explicitRound, index);
  }
  return getRoundLabel(roundKey, index);
}

function getVoteRoundEntries(voteAnalysis) {
  if (Array.isArray(voteAnalysis)) {
    return voteAnalysis.map((roundValue, index) => [`round${index + 1}`, roundValue]);
  }

  if (!voteAnalysis || typeof voteAnalysis !== "object") {
    return [];
  }

  const roundListKeys = [
    "rounds",
    "vote_rounds",
    "voteRounds",
    "round_details",
    "roundDetails",
    "items",
    "records",
    "details",
    "data",
  ];
  const roundListEntry = roundListKeys
    .map((key) => [key, voteAnalysis[key]])
    .find(([, value]) => Array.isArray(value) && value.length);

  if (roundListEntry) {
    return roundListEntry[1].map((roundValue, index) => [`round${index + 1}`, roundValue]);
  }

  // Per-round vote-count keys such as "day1_votes" / "round2_votes", typically
  // accompanied by shared "outcome"/"analysis" siblings that describe the round.
  const dayVoteEntries = Object.entries(voteAnalysis).filter(
    ([key, value]) => /votes?$/i.test(key) && /\d/.test(key) && value && typeof value === "object"
  );

  if (dayVoteEntries.length) {
    const sharedOutcome = pickFirstValue(voteAnalysis, ["outcome", "result", "voted_out", "votedOut"]);
    const sharedAnalysis = pickFirstValue(voteAnalysis, ["analysis", "anomaly", "anomalies", "observation", "note"]);
    const onlyRound = dayVoteEntries.length === 1;
    return dayVoteEntries.map(([key, voteCounts]) => [
      key,
      {
        vote_counts: voteCounts,
        outcome: onlyRound ? sharedOutcome : "",
        analysis: onlyRound ? sharedAnalysis : "",
      },
    ]);
  }

  return Object.entries(voteAnalysis);
}

function pickFirstValue(source, keys) {
  if (!source || typeof source !== "object") return "";
  const value = keys.map((key) => source[key]).find((entry) => isPresent(entry));
  return value === undefined ? "" : value;
}

function buildVoteCountLabel(playerId, count) {
  if (count && typeof count === "object") {
    const nestedCount = pickFirstValue(count, ["count", "votes", "vote_count", "voteCount", "total"]);
    const nestedPlayer = pickFirstValue(count, ["player", "player_name", "playerName", "target", "name", "id"]);
    return buildVoteCountLabel(nestedPlayer || playerId, isPresent(nestedCount) ? nestedCount : formatGeneralValue(count));
  }

  if (!isPresent(playerId) && !isPresent(count)) return "";
  if (!isPresent(count)) return formatGeneralValue(playerId);
  return `${normalizePlayerId(playerId)} ${count}票`;
}

function buildVotePlayers(voteCounts) {
  if (!voteCounts) return [];

  if (Array.isArray(voteCounts)) {
    return voteCounts
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return formatGeneralValue(item);
        const playerId = pickFirstValue(item, ["player", "player_name", "playerName", "target", "name", "id"]);
        const count = pickFirstValue(item, ["count", "votes", "vote_count", "voteCount", "total"]);
        return buildVoteCountLabel(playerId, count);
      })
      .filter(Boolean);
  }

  if (typeof voteCounts === "object") {
    return Object.entries(voteCounts)
      .map(([playerId, count]) => buildVoteCountLabel(playerId, count))
      .filter(Boolean);
  }

  return parseVoteChips(String(voteCounts));
}

function buildMarkdownVoteRounds(section) {
  return listLines(section)
    .map((line, index) => {
      const jsonStart = line.indexOf("{");
      const item = parseJson(jsonStart >= 0 ? line.slice(jsonStart) : line);
      const roundMatch = line.slice(0, jsonStart >= 0 ? jsonStart : line.length).match(/round[_\s-]*(\d+)/i);
      return item
        ? {
            round: `第 ${item.round || roundMatch?.[1] || index + 1} 轮投票`,
            headline: item.vote_summary || "本轮票型待分析",
            voteSummary: item.vote_summary || "",
            anomaly: item.anomalies || item.anomaly || "",
            players: parseVoteChips(item.vote_summary),
          }
        : null;
    })
    .filter(Boolean);
}

function buildStructuredVoteRounds(voteAnalysis) {
  if (!voteAnalysis) return [];

  return getVoteRoundEntries(voteAnalysis).map(([roundKey, roundValue], index) => {
    if (typeof roundValue === "string") {
      return {
        round: getVoteRoundLabel(roundKey, null, index),
        headline: roundValue,
        voteSummary: roundValue,
        anomaly: "",
        players: parseVoteChips(roundValue),
      };
    }

    if (!roundValue || typeof roundValue !== "object") {
      const voteSummary = formatGeneralValue(roundValue) || "本轮票型待分析";
      return {
        round: getVoteRoundLabel(roundKey, null, index),
        headline: voteSummary,
        voteSummary,
        anomaly: "",
        players: parseVoteChips(voteSummary),
      };
    }

    const voteCounts = pickFirstValue(roundValue, ["vote_counts", "voteCounts", "counts", "vote_count", "voteCount"]);
    const players = buildVotePlayers(voteCounts);
    const voteSummary =
      pickFirstValue(roundValue, ["vote_summary", "voteSummary", "summary", "result", "description"]) ||
      (players.length ? players.join("，") : "本轮无有效投票");
    const outcome = pickFirstValue(roundValue, ["outcome"]);
    const votedOut = pickFirstValue(roundValue, ["voted_out", "votedOut", "eliminated", "out", "exiled"]);

    return {
      round: getVoteRoundLabel(roundKey, roundValue, index),
      headline: outcome || (votedOut ? `${votedOut} 被投出局` : voteSummary),
      voteSummary,
      anomaly: pickFirstValue(roundValue, ["anomaly", "anomalies", "analysis", "observation", "note"]),
      players: players.length ? players : parseVoteChips(voteSummary),
    };
  });
}

function issuePlayerLabel(issue, index) {
  const match = String(issue).match(/^(多名玩家|全员|狼人阵营|好人阵营|预言家|女巫|\d+号玩家?)/);
  return match?.[1] || `问题 ${index + 1}`;
}

function buildSpeechIssues(markdownSection, structuredIssues) {
  if (Array.isArray(structuredIssues) && structuredIssues.length) {
    return structuredIssues.map((item, index) => ({
      player: typeof item === "string" ? issuePlayerLabel(item, index) : item.player || `问题 ${index + 1}`,
      issue: typeof item === "string" ? item : item.issue || "未提供问题描述",
      phase: typeof item === "string" ? "" : item.phase_or_round || item.round || "",
      evidence: typeof item === "string" ? "" : item.evidence || "",
      impact: typeof item === "string" ? "" : item.impact || "",
      reason: typeof item === "string" ? "" : item.reason || "",
      detailRows: typeof item === "string" ? [] : toDetailRows(item, ["phase_or_round", "evidence", "impact", "reason"]),
    }));
  }

  return listLines(markdownSection)
    .map((line, index) => {
      const item = parseJson(line);
      return item
        ? {
            player: item.player || `问题 ${index + 1}`,
            issue: item.issue || "未提供问题描述",
            phase: item.phase_or_round || item.round || "",
            evidence: item.evidence || "",
            impact: item.impact || "",
            reason: item.reason || "",
            detailRows: toDetailRows(item, ["phase_or_round", "evidence", "impact", "reason"]),
          }
        : {
            player: issuePlayerLabel(line, index),
            issue: line,
            reason: "",
            detailRows: [],
          };
    });
}

function parseLabeledItems(section) {
  return listLines(section).map((line) => {
    const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
    return match ? { title: match[1].trim(), detail: match[2].trim() } : { title: "", detail: line };
  });
}

function normalizeSkillTitle(label) {
  const text = String(label || "").trim();
  if (!text) return "技能表现";

  const roleLabelMap = {
    predictor: "预言家",
    seer: "预言家",
    witch: "女巫",
    wolf: "狼人",
    werewolf: "狼人",
    villager: "平民",
    civilian: "平民",
    hunter: "猎人",
  };
  if (roleLabelMap[text.toLowerCase()]) return roleLabelMap[text.toLowerCase()];

  const roleMatch = text.match(/(预言家|女巫|猎人|狼人|村民|平民)/);
  if (!roleMatch) return text;

  const role = roleMatch[1];
  let player = text
    .replace(new RegExp(`[，,、\\s]*${role}[，,、\\s]*`), "")
    .replace(/[(（]\s*[)）]/g, "")
    .replace(/[，,、\s]+$/g, "")
    .trim();
  if (/^[(（].*[)）]$/.test(player)) {
    player = player.slice(1, -1).trim();
  }
  player = player
    .replace(/[(（]\s*[)）]/g, "")
    .replace(/[，,、\s]+$/g, "")
    .trim();

  return player && player !== role ? `${role}（${player}）` : role;
}

const skillMetaKeys = new Set([
  "id",
  "name",
  "player",
  "role",
  "skill",
  "target",
  "title",
  "username",
  "position",
]);

const skillDetailKeys = [
  "evaluation",
  "assessment",
  "performance",
  "result",
  "analysis",
  "summary",
  "note",
  "comment",
  "reason",
  "impact",
  "usage",
  "usage_summary",
  "skill_usage",
  "detail",
  "description",
  "text",
  "content",
];

function getChineseNumber(value) {
  const number = Number(value);
  return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][number] || String(value);
}

function formatSkillDetailKey(key) {
  const dayMatch = String(key).match(/^day[_-]?(\d+)$/i);
  if (dayMatch) return `第${getChineseNumber(dayMatch[1])}天`;

  const nightMatch = String(key).match(/^night[_-]?(\d+)$/i);
  if (nightMatch) return `第${getChineseNumber(nightMatch[1])}夜`;

  const labelMap = {
    action: "行动",
    actions: "行动",
    evaluation: "评价",
    assessment: "评价",
    performance: "表现",
    result: "结果",
    analysis: "分析",
    summary: "总结",
    note: "备注",
    comment: "点评",
    reason: "原因",
    impact: "影响",
    usage: "使用情况",
    usage_summary: "使用情况",
    skill_usage: "技能使用",
    detail: "详情",
    description: "说明",
    text: "内容",
    content: "内容",
  };
  return labelMap[key] || key;
}

function formatSkillDetailValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(formatSkillDetailValue).filter(Boolean).join("；");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
      .map(([entryKey, entryValue]) => `${formatSkillDetailKey(entryKey)}：${formatSkillDetailValue(entryValue)}`)
      .join("；");
  }
  return String(value);
}

function buildSkillDetail(item) {
  if (!item || typeof item !== "object") return "";

  const actions = Array.isArray(item.actions)
    ? item.actions.filter(Boolean).map(formatSkillDetailValue).join("；")
    : formatSkillDetailValue(item.actions);
  const evaluation = skillDetailKeys.map((key) => formatSkillDetailValue(item[key])).find(Boolean) || "";
  const knownKeys = new Set(["actions", ...skillDetailKeys]);
  const extraDetails = Object.entries(item)
    .filter(([key, value]) => !skillMetaKeys.has(key) && !knownKeys.has(key) && value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${formatSkillDetailKey(key)}：${formatSkillDetailValue(value)}`)
    .join("；");

  return [actions, evaluation, extraDetails].filter(Boolean).join("；").replace(/^；|；$/g, "");
}

function buildSkillTitleFromParts(role, player, fallback) {
  const roleTitle = role ? normalizeSkillTitle(role) : "";
  if (roleTitle && player) return `${roleTitle}（${player}）`;
  return normalizeSkillTitle(roleTitle || player || fallback);
}

function buildMarkdownSkills(markdownSection) {
  return parseLabeledItems(markdownSection).map((item) => {
    if (item.title) {
      return {
        title: normalizeSkillTitle(item.title),
        detail: item.detail,
      };
    }
    return { title: normalizeSkillTitle(item.detail), detail: item.detail };
  });
}

function buildSkills(markdownSection, structuredSkills) {
  const markdownSkills = buildMarkdownSkills(markdownSection);

  if (Array.isArray(structuredSkills) && structuredSkills.length) {
    return structuredSkills.map((item, index) => {
      const markdownFallback = markdownSkills[index] || {};
      if (typeof item === "string") {
        const parsed = parseJson(item);
        if (parsed) {
          const detail = buildSkillDetail(parsed) || markdownFallback.detail || item;
          return {
            title: buildSkillTitleFromParts(
              parsed.role || parsed.title || parsed.skill,
              parsed.player,
              markdownFallback.title,
            ),
            detail,
          };
        }
        return { title: normalizeSkillTitle(item), detail: item };
      }

      const detail = buildSkillDetail(item) || markdownFallback.detail || "未提供技能评估详情";
      const title = buildSkillTitleFromParts(item.role || item.title || item.skill, item.player, markdownFallback.title);
      return {
        title,
        detail,
        player: item.player || "",
        role: item.role || "",
        phase: item.phase_or_round || item.round || "",
        action: item.action || item.actions || "",
        evaluation: item.evaluation || item.assessment || item.performance || "",
        evidence: item.evidence || "",
        detailRows: toDetailRows(item, ["phase_or_round", "action", "evaluation", "evidence"]),
      };
    });
  }

  return markdownSkills;
}

function buildMistakes(markdownSection, structuredMistakes) {
  if (Array.isArray(structuredMistakes) && structuredMistakes.length) {
    return structuredMistakes.map((item) =>
      typeof item === "string"
        ? { title: "风险点", detail: item }
        : {
            title: item.target || item.player || item.role || "关键失误",
            detail: item.problem || item.mistake || item.issue || item.detail || "未提供失误描述",
            target: item.target || item.player || "",
            phase: item.phase_or_round || item.round || "",
            problem: item.problem || item.mistake || item.issue || "",
            evidence: item.evidence || "",
            consequence: item.consequence || item.impact || "",
            betterAction: item.better_action || item.betterAction || item.suggestion || "",
            detailRows: toDetailRows(item, ["phase_or_round", "evidence", "consequence", "impact", "better_action"]),
          },
    );
  }
  return listLines(markdownSection).map((detail) => ({ title: "风险点", detail }));
}

function buildRecommendationItem(item) {
  if (typeof item === "string") {
    return {
      target: "建议",
      problem: item,
      summary: item,
      detailRows: [],
    };
  }

  const summary = item.problem || item.recommendation || item.suggestion || item.advice || item.detail || "";
  return {
    target: item.target || item.player || item.role || item.camp || item.group || "建议",
    phase: item.phase_or_round || item.round || "",
    problem: summary || formatGeneralValue(item),
    evidence: item.evidence || "",
    betterAction: item.better_action || item.betterAction || item.recommendation || item.suggestion || item.advice || "",
    expectedGain: item.expected_gain || item.expectedGain || "",
    summary: summary || formatGeneralValue(item),
    detailRows: toDetailRows(item, ["phase_or_round", "evidence", "better_action", "expected_gain"]),
  };
}

function buildRecommendationLayers(recommendationLayers) {
  if (!recommendationLayers || typeof recommendationLayers !== "object") return [];

  const layerTitles = {
    player_specific: "玩家专项建议",
    team_coordination: "阵营协作建议",
    training_focus: "训练重点",
  };

  return Object.entries(recommendationLayers)
    .map(([key, value]) => {
      const items = Array.isArray(value) ? value.map(buildRecommendationItem) : [];
      return {
        key,
        title: layerTitles[key] || formatGeneralKey(key),
        items,
      };
    })
    .filter((layer) => layer.items.length);
}

function formatStrategyRecommendation(item) {
  if (!item) return "";
  if (typeof item === "string") {
    const parsed = parseJson(item);
    return parsed ? formatStrategyRecommendation(parsed) : item;
  }
  if (typeof item !== "object") {
    return String(item);
  }

  const target = item.target || item.role || item.player || item.camp || item.group || "";
  const recommendation =
    item.recommendation ||
    item.suggestion ||
    item.advice ||
    item.detail ||
    item.text ||
    item.content ||
    "";

  if (target && recommendation) {
    return `${target}：${recommendation}`;
  }
  if (recommendation) {
    return recommendation;
  }

  return Object.entries(item)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}：${Array.isArray(value) ? value.join("、") : String(value)}`)
    .join("；");
}

function buildStrategyRecommendations(markdownSection, structuredRecommendations) {
  const source = Array.isArray(structuredRecommendations) && structuredRecommendations.length
    ? structuredRecommendations
    : listLines(markdownSection);

  return source.map(formatStrategyRecommendation).filter(Boolean);
}

function buildActionItems(structuredActionItems, structuredActionItemsDetailed, markdownSection) {
  if (Array.isArray(structuredActionItemsDetailed) && structuredActionItemsDetailed.length) {
    return structuredActionItemsDetailed.map((item, index) => ({
      owner: item.owner || `行动项 ${index + 1}`,
      task: item.task || item.title || "待办任务",
      basis: item.basis || item.reason || item.evidence || "",
      deliverable: item.deliverable || item.output || item.result || "",
      raw: formatGeneralValue(item),
      detailRows: toDetailRows(item, ["basis", "deliverable"]),
    }));
  }

  const source = Array.isArray(structuredActionItems) && structuredActionItems.length
    ? structuredActionItems
    : listLines(markdownSection);

  return source.map((item, index) => {
    if (typeof item === "object" && item) {
      return {
        owner: item.owner || `行动项 ${index + 1}`,
        task: item.task || item.title || formatGeneralValue(item),
        basis: item.basis || item.reason || item.evidence || "",
        deliverable: item.deliverable || item.output || item.result || "",
        raw: formatGeneralValue(item),
        detailRows: toDetailRows(item, ["basis", "deliverable"]),
      };
    }

    const parts = String(item || "").split("|").map((part) => part.trim()).filter(Boolean);
    return {
      owner: parts[0] || `行动项 ${index + 1}`,
      task: parts[1] || String(item || ""),
      basis: (parts.find((part) => part.startsWith("依据")) || "").replace(/^依据[:：]\s*/, ""),
      deliverable: (parts.find((part) => part.startsWith("产出")) || "").replace(/^产出[:：]\s*/, ""),
      raw: String(item || ""),
      detailRows: [],
    };
  }).filter((item) => item.task || item.raw);
}

function getWinningCamp(summary, baseMeta) {
  const match = summary.match(/(好人|狼人)阵营(?:最终)?获胜/);
  return match ? `${match[1]}阵营获胜` : baseMeta.winningCamp;
}

function buildMeta(baseMeta, summary, gameId, overrides = {}) {
  const modeMatch = summary.match(/(\d+)人/);
  const winningCamp = overrides.winnerLabel
    ? `${overrides.winnerLabel}获胜`
    : getWinningCamp(summary, baseMeta);
  const mode = overrides.playerCount
    ? `${overrides.playerCount} 人局`
    : modeMatch
    ? `${modeMatch[1]} 人局`
    : baseMeta.mode;
  return {
    ...baseMeta,
    gameId: gameId || baseMeta.gameId || "——",
    mode,
    winningCamp,
    narrator: summary || baseMeta.narrator,
  };
}

function buildOverview(meta, voteRounds, speechIssues, skills, mistakes) {
  const featuredSkill = skills.find((item) => item.title.includes("女巫")) || skills[0];
  return [
    {
      label: "胜利阵营",
      value: meta.winningCamp,
      note: "由 AI 复盘报告提取的对局结论",
    },
    {
      label: "票型分析",
      value: `${voteRounds.length} 轮`,
      note: voteRounds.length ? "投票结果与异常观察已整理" : "报告未提供票型记录",
    },
    {
      label: "发言问题",
      value: `${speechIssues.length} 项`,
      note: speechIssues.length ? "需要重点回看的发言风险" : "报告未标记明显问题",
    },
    {
      label: "关键技能",
      value: featuredSkill ? featuredSkill.title : "待分析",
      note: featuredSkill ? featuredSkill.detail : `${mistakes.length} 项关键失误待复核`,
    },
  ];
}

function buildReportData(baseReport, replayText, gameId, structuredReport = null, metaOverrides = {}) {
  const sections = extractSections(replayText);
  const structured = structuredReport || parseJson(replayText) || extractFencedJson(replayText);
  const summaryText = structured?.narrative_report || structured?.summary_report || sections.summary || findNarrative(replayText) || baseReport.meta.narrator;
  const summaryParagraphs = splitParagraphs(summaryText);
  const markdownVoteRounds = buildMarkdownVoteRounds(sections.votes);
  const voteRounds = structured?.vote_analysis
    ? buildStructuredVoteRounds(structured.vote_analysis)
    : markdownVoteRounds;
  const speechIssues = buildSpeechIssues(sections.speech, structured?.speech_issues);
  const skillEvaluations = buildSkills(sections.skills, structured?.skill_evaluation);
  const mistakes = buildMistakes(sections.mistakes, structured?.mistakes);
  const strategyRecommendations = buildStrategyRecommendations(
    sections.recommendations,
    structured?.strategy_recommendations,
  );
  const recommendationLayers = buildRecommendationLayers(structured?.recommendation_layers);
  const actionItems = buildActionItems(structured?.action_items, structured?.action_items_structured, sections.actions);
  const meta = buildMeta(baseReport.meta, summaryText, gameId, metaOverrides);

  return {
    meta,
    summaryParagraphs,
    overview: buildOverview(meta, voteRounds, speechIssues, skillEvaluations, mistakes),
    voteRounds,
    speechIssues,
    skillEvaluations,
    mistakes,
    recommendationLayers,
    strategyRecommendations,
    actionItems,
    narrativeReport: summaryText,
    heroTags: [
      `${voteRounds.length} 轮票型分析`,
      `${speechIssues.length} 项发言问题`,
      `${mistakes.length} 项关键失误`,
      `${recommendationLayers.reduce((total, layer) => total + layer.items.length, 0)} 条分层建议`,
      `${actionItems.length} 个行动项`,
    ],
  };
}

export const reportData = ref(buildReportData(mockReportData, aiReplaySampleText));
export const isLoading = ref(false);
export const loadError = ref(null);

function takeTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || params.get("accessToken");
  if (!token) return "";

  params.delete("token");
  params.delete("accessToken");
  sessionStorage.setItem("accessToken", token);
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
  return token;
}

function getCookie(name) {
  const match = document.cookie.split(";").find((cookie) => cookie.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : "";
}

function getAuthToken() {
  return takeTokenFromUrl() || getCookie("accessToken") || sessionStorage.getItem("accessToken") || "";
}

function resolveFilePath(data, format) {
  const files = data.analysisFiles || data.analysis_files || data.replayFiles || data.replay_files || {};
  const filePath = format === "json"
    ? files.json || files.jsonPath || files.json_path || data.jsonPath || data.json_path
    : files.text || files.txt || files.path || files.report || data.textPath || data.text_path || data.path;
  return typeof filePath === "string" ? filePath : null;
}

async function fetchReplayFile(filePath) {
  if (!filePath) return "";
  const response = await fetch(`/api/game/replay/file?file=${encodeURIComponent(filePath)}`);
  return response.text();
}

function getStructuredReport(value) {
  if (!value) return null;
  if (typeof value === "string") return parseJson(value);
  if (typeof value === "object") return Object.keys(value).length ? value : null;
  return null;
}

function resolveDetailData(json) {
  if (json && Object.prototype.hasOwnProperty.call(json, "success")) {
    return json.data || {};
  }
  return json || {};
}

export async function loadReport(gameId) {
  isLoading.value = true;
  loadError.value = null;
  try {
    const token = getAuthToken();
    const res = await fetch(`/api/game/replay/detail/auth?gameId=${encodeURIComponent(gameId)}`, {
      method: "GET",
      headers: { authorization: token },
    });
    const json = await res.json();
    if (json.success === false) {
      loadError.value = json.errorMessage || "复盘分析失败";
      return;
    }
    const data = resolveDetailData(json);
    const analysis = data.analysis || {};
    let text = typeof analysis.text === "string" ? analysis.text : "";
    let structuredReport = getStructuredReport(analysis.json || data.analysisJson || data.analysis_json);
    const textPath = resolveFilePath(data, "text");
    const jsonPath = resolveFilePath(data, "json");

    const [fileText, jsonText] = await Promise.all([
      !text && textPath ? fetchReplayFile(textPath) : Promise.resolve(""),
      !structuredReport && jsonPath ? fetchReplayFile(jsonPath) : Promise.resolve(""),
    ]);
    text = text || fileText;
    structuredReport = structuredReport || parseJson(jsonText);

    if (!text && !structuredReport) {
      loadError.value = "未找到复盘内容";
      return;
    }

    const metaOverrides = {
      winnerLabel: data.winnerLabel || null,
      playerCount: data.playerCount || null,
    };

    reportData.value = buildReportData(mockReportData, text || "", data.gameId || gameId, structuredReport, metaOverrides);
  } catch (err) {
    loadError.value = err.message || "加载失败";
  } finally {
    isLoading.value = false;
  }
}
