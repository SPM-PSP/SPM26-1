export const reportData = {
  meta: {
    title: "雾中窥影复盘卷宗",
    subtitle: "基于 AI 复盘结果生成的对局档案与行为分析",
    gameId: "20251221_114858",
    mode: "9 人局",
    winningCamp: "狼人阵营获胜",
    reportSource: "AI 复盘 + 结构化日志",
    narrator:
      "这一局的关键不在单次爆点，而在真预言家被持续怀疑后，场上共识被狼人稳稳牵引。",
  },
  overview: [
    {
      label: "关键转折",
      value: "第 2 天发言轮",
      note: "真预言家被集体质疑后失去带队权",
      tone: "claret",
    },
    {
      label: "高危玩家",
      value: "Player7",
      note: "欺骗指数最高，且成功完成焦点转移",
      tone: "forest",
    },
    {
      label: "核心误判",
      value: "2 次",
      note: "女巫与两名村民在同一轮站错边",
      tone: "moss",
    },
    {
      label: "AI 判定",
      value: "中后期失控",
      note: "好人阵营在第三轮后已难以修正票型",
      tone: "ember",
    },
  ],
  timeline: [
    {
      stage: "首夜",
      title: "信息优势出现得太早",
      detail:
        "预言家首夜验出狼人后选择在白天过早强势起跳，信息正确，但没有配套建立信任链。",
      icon: "wb_twilight",
    },
    {
      stage: "第一天",
      title: "狼队完成第一次舆论偏转",
      detail:
        "Player7 没有正面打验人逻辑，而是持续放大发言态度问题，把讨论从“真假”改成了“像不像真预言家”。",
      icon: "campaign",
    },
    {
      stage: "第二夜",
      title: "女巫决策被沉没成本绑住",
      detail:
        "Player2 因首夜救人而过度维护前置判断，第二天投票时没能及时修正视角。",
      icon: "auto_awesome",
    },
    {
      stage: "终局前",
      title: "票型收束，村阵营失去翻盘窗口",
      detail:
        "从第二轮开始，怀疑链和投票链高度重合，狼人只需维持节奏，不需要再额外冒险。",
      icon: "nights_stay",
    },
  ],
  voteRounds: [
    {
      round: "第 1 轮投票",
      headline: "焦点形成但尚未定局",
      summary: "Player6 与 Player7 成为双中心，场上仍有三种不同站边。",
      players: ["Player6 4 票", "Player7 3 票", "弃权/摇摆 2 人"],
    },
    {
      round: "第 2 轮投票",
      headline: "错误共识被锁定",
      summary: "Player6 被进一步放大可疑感，真预言家在此轮被挤出带队位。",
      players: ["Player6 5 票", "Player7 2 票", "跟票 2 人"],
    },
    {
      round: "第 3 轮投票",
      headline: "票型已无修正空间",
      summary: "村阵营出现连续跟票，狼人不再需要暴露协同痕迹。",
      players: ["Player3 1 票", "Player8 4 票", "Player9 3 票"],
    },
  ],
  speechIssues: [
    {
      player: "Player6",
      round: "第 1 天",
      excerpt: "我必须今天把 7 号推出去，不然今晚一定出大事。",
      reason: "结论过满，缺少可验证的后续计划，导致真信息没有转化为可信信息。",
    },
    {
      player: "Player7",
      round: "第 1 天",
      excerpt: "他不是在聊验人，他是在逼大家现在就站队。",
      reason: "成功把讨论从信息真伪切到表达方式，是一次高质量的转移焦点。",
    },
    {
      player: "Player2",
      round: "第 2 天",
      excerpt: "我前面既然保过他，就不觉得我会完全看错。",
      reason: "明显带有沉没成本心态，优先维护旧判断而不是吸收新证据。",
    },
  ],
  players: [
    {
      id: "Player2",
      roleKey: "witch",
      role: "女巫",
      alignment: "好人",
      summary: "前置信息充足，但后续修正能力不足。",
      metrics: {
        cognitiveConsistency: 0.71,
        stressResponse: 0.54,
        strategyPurity: 0.46,
        expressiveness: 0.63,
        deceptionScore: 0.22,
      },
    },
    {
      id: "Player6",
      roleKey: "seer",
      role: "预言家",
      alignment: "好人",
      summary: "信息正确，节奏错误，发言强度压过了证据组织。",
      metrics: {
        cognitiveConsistency: 0.92,
        stressResponse: 0.35,
        strategyPurity: 0.58,
        expressiveness: 0.74,
        deceptionScore: 0.31,
      },
    },
    {
      id: "Player7",
      roleKey: "werewolf",
      role: "狼人",
      alignment: "狼人",
      summary: "最强的舆论操盘点，冷静、克制，而且持续在定义问题。",
      metrics: {
        cognitiveConsistency: 0.44,
        stressResponse: 0.81,
        strategyPurity: 0.84,
        expressiveness: 0.77,
        deceptionScore: 0.86,
      },
    },
    {
      id: "Player8",
      roleKey: "villager",
      role: "村民",
      alignment: "好人",
      summary: "跟票倾向明显，发言密度偏低，容易被主流节奏裹挟。",
      metrics: {
        cognitiveConsistency: 0.67,
        stressResponse: 0.49,
        strategyPurity: 0.41,
        expressiveness: 0.38,
        deceptionScore: 0.18,
      },
    },
  ],
  network: {
    avgTrust: 0.56,
    echoChambers: 2,
    interpretation:
      "场上在第二轮后出现两个稳定的回声室，一个围绕 Player7 生成，另一个围绕 Player6 的反对链生成。",
    links: [
      {
        source: "Player7",
        target: "Player3",
        type: "ally",
        note: "夜间与白天判断方向高度一致，但白天避免了过于明显的互保。",
      },
      {
        source: "Player7",
        target: "Player6",
        type: "suspect",
        note: "高频制造怀疑并持续占据议题定义权。",
      },
      {
        source: "Player2",
        target: "Player4",
        type: "trust",
        note: "基于首夜事件建立事实型信任，但未能扩展成阵营信任网络。",
      },
      {
        source: "Player8",
        target: "Player6",
        type: "suspect",
        note: "跟随主流表达，缺乏独立推理支撑。",
      },
    ],
  },
  strategyRecommendations: [
    "真预言家起跳后，不要只给结论，要同步给出票型路径和后续验人计划。",
    "女巫类角色在首夜救人后，要刻意防范沉没成本，第二天重新做一次独立判断。",
    "村民位如果发言弱，就更应该明确记录自己为何跟票，否则会自然滑入错误共识。",
  ],
  actionItems: [
    "复核第 1 天 Player6 与 Player7 的完整对话，单独提炼“信息”和“态度”两条讨论线。",
    "把第 2 轮投票前所有玩家立场做成矩阵，检查谁最早完成了错误站边收束。",
    "为预言家位补一份“强信息但弱信任”场景下的标准发言模板。",
  ],
};
