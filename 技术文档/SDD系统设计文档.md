

## 3. 系统总体架构

### 3.1 架构设计思想
本系统当前采用前后端分离、后端分层组织的总体架构。前端负责房间界面展示、用户交互与状态呈现，后端统一承担业务控制、游戏流程调度、实时通信和数据持久化等职责。

考虑到狼人杀系统具有明显的阶段性、状态性和实时性特征，系统架构设计重点围绕以下三点展开：

1. **规则与界面分离**  ：将前端展示逻辑与后端游戏规则处理解耦，避免核心游戏流程依赖页面实现。
2. **业务处理与数据访问分离**  ：后端通过 Controller、Service、Model 的分层组织方式，将请求接入、业务处理和数据持久化区分开来，使系统结构更加清晰，也便于后续维护和扩展。
3. **实时交互与数据持久化并重**  ：由于游戏过程对实时性要求较高，因此系统通过 WebSocket 实现状态同步和消息推送；同时通过 MySQL 保存用户、房间和对局等关键数据，保证系统运行过程中数据可追踪、结果可查询。


### 3.2 架构分层
#### 3.2.1 整体架构图

#### 3.2.2 各层功能概述

1. **表现层**  ：表现层是系统面向用户的直接交互入口，主要负责用户界面展示、页面布局组织、玩家交互输入和游戏状态渲染。该层将承担登录、大厅、房间、游戏主界面、投票面板以及AI复盘报告等页面呈现任务，并基于 MobX 进行前端状态管理，使页面能够及时响应房间状态、玩家信息和游戏阶段的变化。
2. **接口访问层** ：接口访问层主要通过 Axios 对前后端的 REST 接口进行统一封装，负责发送和接收登录认证、创建房间、加入房间、查询房间状态、获取对局记录等非实时请求。通过这一层的封装，可以减少页面组件对底层请求细节的直接依赖，同时便于后续统一处理 Token 注入、异常提示和请求重试等功能。
3. **控制层** ：控制层位于后端接入侧，负责接收客户端请求、完成路由分发、基础参数校验、权限验证和请求上下文组织，并将具体业务逻辑交由 Service 层处理。该层不直接承载复杂的游戏规则处理，而是作为外部请求到领域逻辑之间的协调层，保证系统入口统一、处理流程清晰。
4. **领域服务层**：领域服务层是当前系统的核心业务层，承担房间管理、角色分配、开局控制、阶段流转、投票统计、技能执行、胜负判定等关键规则处理任务。本项目属于典型的状态驱动型博弈系统，昼夜切换、角色行动顺序、投票放逐和平票处理都要求统一的规则中枢，因此该层本质上承担了“游戏引擎”的职责。
5. **数据访问层** ：数据访问层基于 Sequelize Model 和 MySQL 实现，负责用户信息、房间信息、游戏记录等结构化数据的持久化存储。通过 ORM 方式访问数据库，可以降低业务逻辑与底层 SQL 的耦合程度，也有利于后续数据模型的维护与调整。
6. **实时通信层**  ：实时通信层负责处理游戏过程中的高频、低延迟消息同步与状态推送，包括房间成员变化、阶段切换、倒计时广播、投票结果、放逐结果、系统提示等。由于狼人杀对局具有较强的实时性，若仅依赖轮询式 HTTP 接口将难以满足多人同步体验，因此系统将通过 WebSocket 建立双向通信机制，实现服务端主动推送与客户端状态即时更新。
7. **辅助支撑层** ：辅助层为系统运行提供必要的支撑能力，主要包括 NodeCache、日志组件和权限中间件等。其中NodeCache 用于保存倒计时等短周期临时状态；日志组件用于记录运行过程中的关键操作和异常信息，为对局记录与后续排障提供支持；权限中间件则负责基础的身份校验与访问控制。虽然这些能力不直接参与业务规则处理，但它们对于满足系统稳定性、安全性和可维护性要求至关重要。



## 5. 核心模块设计

### 5.1 用户/鉴权模块
1. 模块职责：
1. 登录鉴权、JWT 发放、接口鉴权校验、用户信息查询。
2. 主要输入输出：
1. 输入：`username/password`、`Authorization`。
2. 输出：统一响应结构 `{success,data,errorCode,errorMessage}`。
3. 核心实现：
1. [server/controller/authController.js](f:/werewolf/server/controller/authController.js)
2. [server/middleware/auth.js](f:/werewolf/server/middleware/auth.js)
3. [server/service/userService.js](f:/werewolf/server/service/userService.js)
4. 当前实现情况：
1. `[已实现]` 登录与 JWT。
2. `[已实现]` 接口鉴权中间件
5. 可改进点：
1. 密码加密方式升级
2. 完善权限校验体系

### 5.2 房间管理模块
1. 模块职责：
1. 创建/加入/退出房间，入座、踢人、观战、房间信息聚合。
2. 主要输入输出：
1. 输入：房间名、房间码、座位号、房间ID。
2. 输出：房间状态、座位信息、等待区、游戏ID。
3. 核心实现：
1. [server/controller/roomController.js](f:/werewolf/server/controller/roomController.js)
2. [server/service/roomService.js](f:/werewolf/server/service/roomService.js)
3. 当前实现情况：
1. `[已实现]` 房间全流程管理
2. `[已实现]` 观战功能
3. 可改进点：
1. 规范 REST 接口风格
2. 并发入座/踢人缺少事务或锁控制，存在竞态风险。

### 5.3 游戏状态机/流程控制模块
1. 模块职责：
1. 阶段推进、阶段结算、倒计时控制、日夜循环。
2. 主要输入输出：
1. 输入：`gameId`、当前阶段、动作数据。
2. 输出：下一阶段状态、结算记录、推送事件。
3. 核心实现：
1. [server/service/gameService.js](f:/werewolf/server/service/gameService.js)
2. [server/service/stageService.js](f:/werewolf/server/service/stageService.js)
3. 当前实现情况：
1. `[已实现]` `0->1->2->3->4->5->6->(6.5)->7->0`。
2. `[已实现]` 夜晚三阶段定时器（预言家/狼人/女巫）。
3. `[已实现]` 平票 PK（可配置）。
4. 可改进点：
1. 部分业务校验依赖前端，服务端阶段校验不完全一致。
2. 状态推进与多表写入缺少事务边界。

### 5.4 角色分配模块
1. 模块职责：
1. 按人数板子分配角色，初始化玩家信息。
2. 主要输入输出：
1. 输入：房间座位、角色配置、技能映射。
2. 输出：`player`、`state`、`game` 初始状态。
3. 核心实现：
1. [server/controller/gameController.js](f:/werewolf/server/controller/gameController.js) `gameStart`
2. [common/constants.js](f:/werewolf/common/constants.js) `gameModeMap/skillMap`
3. 当前实现情况：
1. `[已实现]` 多人数角色配置

### 5.5 白天发言/投票模块
1. 模块职责：
1. 发言顺序生成、投票记录、平票处理、放逐结算、平票PK处理。
2. 主要输入输出：
1. 输入：gameId、投票目标、投票阶段
2. 输出：票型记录、放逐结果、PK 玩家列表
3. 核心实现：
1. [server/service/stageService.js](f:/werewolf/server/service/stageService.js) `preSpeakStage`、`voteStage`
2. [server/controller/gameController.js](f:/werewolf/server/controller/gameController.js) `votePlayer`
3. 当前实现情况：
1. `[已实现]` 随机发言顺序
2. `[已实现]` 投票与票型记录
3. `[已实现]` 平票可直接过夜或进入 PK。
4. 可改进点：
1. 服务端对 PK 阶段投票资格约束不足（主要在前端限制）。
2. 发言内容本身未进入结构化输入（当前以流程控制为主，非语义推理）。

### 5.6 夜晚行动模块
1. 模块职责：
1. 预言家查验、狼人袭击、女巫解药/毒药、夜晚死亡结算。
2. 主要输入输出：
1. 输入：gameId、技能类型、目标玩家
2. 输出：玩家状态变更。
3. 核心实现：
1. [server/controller/gameController.js](f:/werewolf/server/controller/gameController.js) `checkPlayer/assaultPlayer/antidotePlayer/poisonPlayer`
2. [server/service/stageService.js](f:/werewolf/server/service/stageService.js) `wolfStage/witchStage`
3. 当前实现情况：
1. `[已实现]` 全角色夜晚技能
2. `[已实现]` 统一死亡结算
3. 可改进点：
1. 个别动作接口缺少严格阶段校验（可被越阶段调用）。
2. 女巫自救规则校验分散，建议统一在服务端规则引擎收口。

### 5.7 胜负判定模块
1. 模块职责：
1. 阵营存活统计、屠边 / 屠城判定、游戏结束、胜利广播。
2. 主要输入输出：
1. 输入：玩家状态、阵营、胜利条件
2. 输出：游戏结果、胜者阵营、结束广播
3. 核心实现：
1. [server/service/gameService.js](f:/werewolf/server/service/gameService.js) `settleGameOver/setGameWin`
4. 当前实现情况：
1. `[已实现]` 屠边/屠城配置支持。
2. `[已实现]` 夜晚结算后与投票结算后均触发判定。
3. 可改进点：
1. 建议补充更细粒度“终局原因”字段，便于复盘分析。

### 5.8 实时通信模块
1. 模块职责：
1. 房间内状态变更广播、阶段切换通知、倒计时推送。
2. 主要输入输出：
1. 输入：状态变更事件
2. 输出：stageChange、refreshGame、gameOver 等消息
3. 核心实现：
1. [server/application/loader.js](f:/werewolf/server/application/loader.js) `initWs`
2. [client/src/pages/views/room/index.jsx](f:/werewolf/client/src/pages/views/room/index.jsx) `wsMessage`
3. 当前实现情况：
1. `[已实现]` 实时事件广播
2. `[已实现]` 倒计时推送
3. 可改进点：
1. 当前协议无事件版本与签名，建议升级为结构化事件模型。
2. 连接鉴权与断线恢复机制尚不完整。

### 5.9 数据存储模块
1. 模块职责：
1. 数据持久化、CRUD、事务、日志、归档管理。
2. 主要输入输出：
1. 输入：业务实体对象
2. 输出：数据库存储结果
3. 核心实现：
1. [server/mysqlModel](f:/werewolf/server/mysqlModel)
2. [server/service/baseService.js](f:/werewolf/server/service/baseService.js)
3. [sql/mysql_schema.sql](f:/werewolf/sql/mysql_schema.sql)
4. 当前实现情况：
1. `[已实现]` 核心业务表与索引。
2. `[已实现]` JSON 字段承载技能、可见性、事件内容。
3. 可改进点：
1. 完善事务与外键约束
2. 大表归档与索引优化
