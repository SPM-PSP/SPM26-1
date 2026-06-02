# 狼人杀系统 AI 模块单元测试报告

**项目名称**：多智能体在线语音狼人杀系统  
**测试范围**：`代码/AI-Wolf/ai_backend/ai_service` 下 AI 玩家初始化、角色与人格管理、记忆服务、上下文组装、Prompt 构造、模型结果解析、发言规范化、夜晚技能约束、异常兜底、多 AI 狼人协同等内部代码逻辑。  
**测试日期**：2026-06-01  
**测试人员**：沈矜娴  
**测试类型**：自动化单元测试  
**测试命令**：`python -m pytest tests/test_ai_player.py -q`  
**测试文件**：`代码/AI-Wolf/tests/test_ai_player.py`  
**测试规模**：41 个 pytest 测试函数，其中 1 个角色标准化参数化测试展开为 7 个用例，实际执行合计 47 个自动化单元测试用例。  
  

---

## 一、测试范围

本轮测试针对 AI 模块内部最小功能单元补充单元测试，重点验证函数、类和 service 方法的行为是否正确。

测试覆盖范围包括：

- `PlayerFactoryService`：AI 玩家生成、座位分配、模型策略解析、角色写入、配置深拷贝；
- `PersonaService` 与 Prompt 片段函数：人格策略范围、人格式样轮询、默认人格 Prompt；
- `MemoryService`：记忆初始化、事件转换、去重、窗口裁剪、决策记录、预言家已查验目标提取、可疑度计算；
- `ContextAssembler`：AI 上下文标准字段与别名输出；
- `InvokeService`：Prompt 构造、公开上下文提取、私有视野白名单、可见事件敏感字段过滤、发言清洗、投票/夜晚/猎人开枪阶段规范化、异常兜底；
- `LLMGateway` JSON 工具：模型文本中 JSON 对象提取、空输出异常；
- `WerewolfTeamService`：狼人 ID 去重、合法目标过滤、私有视野重建、建议聚合、平局判断、共识写入。

---

## 二、测试命令与文件

| 项目 | 内容 |
| ---- | ---- |
| 测试命令 | `cd 代码/AI-Wolf && python -m pytest tests/test_ai_player.py -q` |
| 实际执行命令 | `python -m pytest tests/test_ai_player.py -q` |
| 测试文件 | `代码/AI-Wolf/tests/test_ai_player.py` |
| pytest 配置 | `代码/AI-Wolf/pytest.ini` |
| 依赖配置 | `pytest>=9.0.3` |

---

## 三、测试环境与 Mock 策略

| 项目 | 内容 |
| ---- | ---- |
| 运行环境 | Windows PowerShell |
| Python 环境 | 已激活的 conda 环境 |
| 测试框架 | `pytest 9.0.3` |
| 外部大模型 API | 使用 `FakeLLMGateway.generate_json()` 返回固定数据或抛异常，不真实调用外部模型 |
| 数据库依赖 | 使用 `InMemoryMemoryRepository`，不连接真实数据库 |
| 房间/接口依赖 | 不创建真实房间，不启动 FastAPI，不访问前端或后端接口 |
| 多狼人协同 | 使用 `FakeInvokeService.invoke_async()` 固定返回每个狼人 AI 的建议 |
| 非确定性文本 | 不断言完整文本一致，只校验非空、字段合法、目标在候选列表中、不含身份暴露表达 |

---

## 四、分模块测试用例

### 4.1 AI 玩家初始化、角色、人格与模型配置

| 测试编号 | 测试内容 | 输入 | 预期结果 | 实际结果 | 通过与否 |
| ---- | ---- | -- | ---- | ---- | ---- |
| UT-AI01 | AI 玩家生成、角色写入与 LLM 深拷贝 | `aiCount=3`，`modelName="unit-model"`，角色分配含 `ai_1` 与不存在的 `ai_9` | 生成 3 个 AI；座位递增；默认人格为 `logical`；只写入存在玩家；LLM 返回副本 | 生成 `ai_1/ai_2/ai_3`，座位 `[1,2,3]`；只应用 `ai_1=werewolf`；修改返回 LLM 副本不影响内部配置 | 通过 |
| UT-AI02 | 模型策略 camelCase 字段解析 | `modelPolicy.modelName`、`modelPolicy.baseUrl` | 字段能映射到 `model_name` 与 `base_url` | `model_name="unit-model"`，`base_url="http://unit.test/v1"` | 通过 |
| UT-AI03 | 玩家查询返回深拷贝 | 生成 `ai_1` 后修改 `get_player()` 返回对象 | 不污染 service 内部玩家对象 | 外部把副本 role 改为 `werewolf` 后，再查内部 role 仍为 `None` | 通过 |
| UT-AI04 | 人格策略数值范围 | `PersonaService.DEFAULT_POLICIES` | `speechRisk`、`voteVolatility`、`followGroup` 均在 `[0,1]` | 所有人格策略三项数值均在合法范围 | 通过 |
| UT-AI05 | 人格轮询分配 | `["ai_1","ai_2","ai_3","ai_4"]` | 按 aggressive、conservative、logical 循环 | 实际为 aggressive、conservative、logical、aggressive | 通过 |
| UT-AI06 | 人格 Prompt 默认值 | `None` 与未知人格字符串 | 使用 logical Prompt | `None` 与 `unknown-style` 返回内容均等于 logical Prompt | 通过 |
| UT-AI07 | 角色标准化：wolf | `"wolf"` | 标准化为 `werewolf` | 返回 `werewolf` | 通过 |
| UT-AI08 | 角色标准化：werewolf | `"werewolf"` | 标准化为 `werewolf` | 返回 `werewolf` | 通过 |
| UT-AI09 | 角色标准化：villagers | `"villagers"` | 标准化为 `villager` | 返回 `villager` | 通过 |
| UT-AI10 | 角色标准化：seer | `"seer"` | 标准化为 `seer` | 返回 `seer` | 通过 |
| UT-AI11 | 角色标准化：witch | `"witch"` | 标准化为 `witch` | 返回 `witch` | 通过 |
| UT-AI12 | 角色标准化：hunter | `"hunter"` | 标准化为 `hunter` | 返回 `hunter` | 通过 |
| UT-AI13 | 角色标准化：空角色 | `None` | 返回 `None` | 返回 `None` | 通过 |

### 4.2 记忆服务与上下文组装

| 测试编号 | 测试内容 | 输入 | 预期结果 | 实际结果 | 通过与否 |
| ---- | ---- | -- | ---- | ---- | ---- |
| UT-AI14 | 记忆初始化 | `gameId="g1"`，玩家 `ai_1/ai_2` | 创建空记忆状态 | 返回 initialized 为 `["ai_1","ai_2"]`，仓库中存在两个状态 | 通过 |
| UT-AI15 | 可见事件空内容与重复过滤 | 空内容事件、重复 speech 事件 | 空内容跳过，重复事件只记录一次 | `memoryWindow` 仅 1 条，内容为 `same public speech` | 通过 |
| UT-AI16 | 记忆窗口裁剪与可疑度计算 | `max_window=2`，多条发言/投票事件，候选 `p1/p2` | 只保留最近 2 条；`p1` 可疑度高于 `p2` | `memoryWindow` 长度为 2；`p1.score > p2.score` | 通过 |
| UT-AI17 | 决策记录最多保留 20 条 | 连续写入 25 条决策 | 只保留最近 20 条 | 第一条保留 idx 为 5，最后一条 idx 为 24 | 通过 |
| UT-AI18 | 预言家已查验目标提取 | `nightAction.inspectTarget=p1` 与 `skillType=inspect, skillTarget=p2` | 去重提取查验目标 | 返回 `["p1","p2"]` | 通过 |
| UT-AI19 | 上下文组装字段与别名 | `AgentProfile`、`AgentMemoryState`、`PersonaPolicy`、存活玩家 | 输出标准上下文键与别名字段 | 包含 `self.ai_id`、`alivePlayers`、`personaPolicy.speechRisk`、`currentStage` | 通过 |

### 4.3 Prompt 构造、敏感信息过滤与文本解析

| 测试编号 | 测试内容 | 输入 | 预期结果 | 实际结果 | 通过与否 |
| ---- | ---- | -- | ---- | ---- | ---- |
| UT-AI20 | 角色阶段、公开上下文与敏感字段综合构造 | 发言请求包含 `privateVision.roleMap`、`visibleEvents.role`、`secretRole` | Prompt 包含角色、阶段、公开上下文；隐藏身份字段被过滤 | user payload 中 `role="villager"`、`stage="speech"`、`publicContext.selfSeat=3`；敏感字段被移除 | 通过 |
| UT-AI21 | 私有视野白名单按角色阶段限制 | werewolf、witch night、hunter death_shot、villager | 各角色只允许对应私有字段 | 狼人允许 `wolfTeammates`，女巫允许 `nightDeathCandidate`，猎人允许 `hunterCanShoot`，村民为空 | 通过 |
| UT-AI22 | 私有视野过滤 | 狼人请求含 `wolfTeammates`、`allowFriendlyFire`、`roleMap`、`allRoles` | 只保留狼人允许字段 | 输出仅含 `wolfTeammates` 与 `allowFriendlyFire` | 通过 |
| UT-AI23 | 可见事件敏感字段递归过滤 | 事件含 `role`、嵌套 `team`、列表内 `secretRole` | 递归移除隐藏身份字段 | 输出只保留公开 `content`、`nested.safe`、`items.text` | 通过 |
| UT-AI24 | 公开上下文提取兼容旧 privateVision | `privateVision` 中传 legacy 上下文字段，同时请求本身有显式上下文 | 优先使用请求显式公开上下文 | 输出 `actualStage="day_speech"`、`selfSeat=3`、`selfDisplayName="AI Player 1"` | 通过 |
| UT-AI25 | 阶段兜底公开发言 | speech、vote、death_shot、night_action | 公开阶段兜底非空，夜晚公开文本为空 | speech/vote/death_shot 均非空，night_action 返回空字符串 | 通过 |
| UT-AI26 | 内部独白与狼人身份泄露检测 | “我是AI玩家”、wolf team 文本、正常追问文本 | 前两者识别为风险文本，正常文本不拦截 | AI 元叙事与狼人团队表达返回 True；正常发言返回 False | 通过 |
| UT-AI27 | Prompt payload 关键字段 | 狼人发言请求，候选目标 `p1/p2` | Prompt user payload 包含 stage、role、candidateTargets、publicContext | 实际包含 `stage="speech"`、`role="werewolf"`、候选 `["p1","p2"]` 和发言顺序 | 通过 |
| UT-AI28 | JSON 代码块解析 | 文本包裹 ```json 代码块 | 提取 JSON 对象 | 返回 `{"actionType":"speech"}` | 通过 |
| UT-AI29 | 空模型输出异常 | 空字符串 | 抛出 `ValueError` | 实际抛出 `ValueError` | 通过 |
| UT-AI30 | 普通文本中提取首个 JSON 对象 | `before {"actionType":"vote","voteTarget":"p1"} after` | 提取第一个 JSON 对象 | 返回 `{"actionType":"vote","voteTarget":"p1"}` | 通过 |

### 4.4 InvokeService 决策规范化与异常兜底

| 测试编号 | 测试内容 | 输入 | 预期结果 | 实际结果 | 通过与否 |
| ---- | ---- | -- | ---- | ---- | ---- |
| UT-AI31 | 正常发言输出与后端格式 | Fake LLM 返回 speech，并混入 vote/skill/night 字段 | 发言非空；发言阶段清空非发言字段；输出别名格式正确 | `actionType="speech"`，`speechText` 非空，`voteTarget/skillType/nightAction` 均为空，别名输出含 `decision.actionType` | 通过 |
| UT-AI32 | 狼人白天发言身份暴露过滤 | Fake LLM 返回“我是狼人/昨晚刀人/狼队友”表达 | 公开发言被替换为安全兜底文本 | 输出非空且不含禁止暴露表达 | 通过 |
| UT-AI33 | 空上下文发言补全 | 空上下文且模型返回空 `speechText` | 返回非空默认发言 | `speechText` 非空，`actionType="speech"` | 通过 |
| UT-AI34 | 模型失败投票兜底 | Fake LLM 抛异常；狼人队友 `w1`，候选 `w1/p1` | 返回 `INVOKE_FAILED`；不投队友 | `fallbackUsed=True`，`errorCode="INVOKE_FAILED"`，`voteTarget="p1"` | 通过 |
| UT-AI35 | 合法目标排除函数 | 候选 `w1/p1/p2`，排除 `w1/missing` | 仅移除存在的排除目标 | 返回 `["p1","p2"]` | 通过 |
| UT-AI36 | 夜晚行动字段归一化 | `skillType="kill"`、`skillTarget="p1"` | 映射到 `nightAction.killTarget` | `killTarget="p1"` | 通过 |
| UT-AI37 | 投票阶段非法目标纠正 | voteTarget 为 `not_alive`，候选 `p1/p2` | 自动改为首个候选目标 | `voteTarget="p1"`，技能字段为空 | 通过 |
| UT-AI38 | 狼人投票避免队友 | 狼人 voteTarget 为队友 `w1`，候选 `w1/p1` | 改投非队友 | `voteTarget="p1"` | 通过 |
| UT-AI39 | 狼人夜晚强制共识目标 | 模型返回刀队友 `w1`，共识目标为合法 `p2` | 最终击杀 `p2` | `skillType="kill"`，`skillTarget="p2"`，`killTarget="p2"` | 通过 |
| UT-AI40 | 预言家避免重复查验 | 已查验 `p1`，模型仍查 `p1`，候选 `p1/p2` | 改查未查验目标 `p2` | `skillType="inspect"`，`inspectTarget="p2"` | 通过 |
| UT-AI41 | 女巫救毒目标限制 | 刀口 `p1`，模型救 `p2` 且毒 `p1` | 救药纠正到刀口；不能毒刀口 | `saveTarget="p1"`，`poisonTarget=None`，`skillType="antidote"` | 通过 |
| UT-AI42 | 猎人被毒出局不能开枪 | `deathReason="poison"`，模型开枪 `p1` | 输出 pass，不产生开枪目标 | `skillType="pass"`，`skillTarget=None` | 通过 |
| UT-AI43 | 缺少 LLM 配置兜底 | `AgentInvokeRequest.llm=None` | 不调用模型，返回兜底发言和 `INVOKE_FAILED` | `fallbackUsed=True`，`errorCode="INVOKE_FAILED"`，兜底发言非空 | 通过 |

### 4.5 多 AI 狼人协同

| 测试编号 | 测试内容 | 输入 | 预期结果 | 实际结果 | 通过与否 |
| ---- | ---- | -- | ---- | ---- | ---- |
| UT-AI44 | 多狼人协同共识聚合 | `werewolfAiIds` 含重复值，三名狼人建议 `p1/p1/p2` | ID 去重；合法目标为非队友；多数建议 `p1` 成为最终目标；写入记忆 | ID 为 `ai_1/ai_2/ai_3`；`legalTargets=["p1","p2"]`；`finalKillTarget="p1"`；三名狼人均记录 `night_consensus` | 通过 |
| UT-AI45 | 狼人协同工具：ID 去重与队友过滤 | ID 列表含重复/空值，候选含队友和 `p1` | 去重后稳定保序；合法目标排除队友 | 去重为 `["ai_1","ai_2"]`；合法目标为 `["p1"]` | 通过 |
| UT-AI46 | 狼人基础私有视野重建 | privateVision 含旧 `consensusTarget/forceConsensusTarget/wolfDecisionMode` | 移除旧共识字段，写入当前队友 | 输出 `{"x":1,"wolfTeammates":["ai_1"]}` | 通过 |
| UT-AI47 | 狼人协同平局检测 | 两个目标推荐次数与置信度相同 | 识别为需要候选顺序打破平局 | `_is_tie_broken_by_order()` 返回 `True` | 通过 |


---

## 五、命令输出


```text
python -m pytest tests/test_ai_player.py -q
...............................................                          [100%]
47 passed, 29 warnings
```

说明：测试过程中出现 29 条 `PydanticDeprecatedSince20` 警告，原因是当前模型类仍使用 Pydantic V1 风格的 `class Config`。该警告不影响本次单元测试通过，但建议后续迁移到 Pydantic V2 的 `ConfigDict`。

---

## 六、测试过程中发现并修正的问题

| 问题 | 修正 |
| ---- | ---- |
| `ModelPolicy` 未声明 `modelName`、`baseUrl` 字段别名，导致外部传入模型策略时无法稳定绑定指定模型 | 在 `ModelPolicy` 中为 `model_name`、`base_url` 增加 alias，并开启 `populate_by_name` |
| `PlayerFactoryService` 对枚举 provider 使用 `str()`，可能得到 `ModelProvider.OPENAI` 而不是 `openai` | 增加 provider 归一化逻辑，枚举取 `.value` |
| 狼人公开发言清洗能拦截 AI 元叙事，但未覆盖“我是狼人/昨晚刀人/狼队友”等直白身份暴露 | 在公开发言/投票阶段增加狼人身份暴露正则检测，命中后替换为安全兜底发言 |

---

## 七、测试汇总

| 模块 | pytest 用例数 | 通过 | 失败 | 通过率 |
| ---- | --------- | ---- | ---- | ------ |
| AI 玩家初始化、角色、人格与模型配置 | 13 | 13 | 0 | 100% |
| 记忆服务与上下文组装 | 6 | 6 | 0 | 100% |
| Prompt 构造、敏感信息过滤与文本解析 | 11 | 11 | 0 | 100% |
| InvokeService 决策规范化与异常兜底 | 13 | 13 | 0 | 100% |
| 多 AI 狼人协同 | 4 | 4 | 0 | 100% |
| **合计** | **47** | **47** | **0** | **100%** |

---

## 八、测试结论

本轮单元测试围绕 AI 服务模块的核心业务逻辑展开，覆盖了 AI 玩家初始化与配置管理、人格策略管理、记忆服务、上下文组装、Prompt 构造、模型结果解析、决策规范化、身份信息保护、夜晚技能约束、异常处理机制以及多 AI 狼人协同等关键功能模块。

测试过程中采用自动化单元测试方式，通过 Mock 大模型服务、内存数据仓库及模拟上下文数据构建测试环境，对各功能单元进行了独立验证。测试不依赖真实数据库、网络服务或外部大模型接口，保证了测试结果的稳定性与可验证性。

测试结果表明，AI 模块在已覆盖场景下能够正确完成游戏信息处理、上下文构造、决策生成与结果规范化等核心功能，并能够有效处理身份暴露风险、非法目标选择、技能边界限制以及模型调用异常等特殊情况。多 AI 狼人协同机制也能够按照预期完成目标聚合与共识决策，保证游戏逻辑的一致性。

本次共执行 47 项自动化单元测试用例，全部通过，整体通过率达到 100%。后续工作中，建议进一步补充真实大模型集成测试、复杂对局场景测试、长上下文推理测试以及 AI 复盘分析模块测试，进一步增强系统在实际运行环境下的可靠性与稳定性。

