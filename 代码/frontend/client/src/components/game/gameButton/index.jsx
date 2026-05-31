import React, { useState } from "react";
import "./index.styl";
import { withRouter } from "react-router-dom";
import { inject, observer } from "mobx-react";
import apiGame from "@api/game";
import { buildReplayPageUrl, waitForReplayReport } from "@common/replay";

import { message, Modal } from "antd";

const { confirm } = Modal;

const Btn = (props) => {
  const { appStore, roomDetail, gameDetail, lookRecord, getRoomDetail, clearGame } = props;
  const [checkingReplay, setCheckingReplay] = useState(false);
  const isOwner = roomDetail && roomDetail.owner === appStore.user.username;
  const currentRole = gameDetail.roleInfo ? gameDetail.roleInfo.role : null;
  const canRoleNextStage =
    gameDetail.status === 1 &&
    ((gameDetail.stage === 1 && currentRole === "predictor") ||
      (gameDetail.stage === 2 && currentRole === "wolf") ||
      (gameDetail.stage === 3 && currentRole === "witch"));
  const canOwnerNextStage = isOwner && gameDetail.status === 1;
  const canNextStage = canOwnerNextStage || canRoleNextStage;

  const openReplayPage = async () => {
    if (gameDetail.status !== 2) {
      message.error('游戏尚未结束，无法进行复盘分析！');
      return;
    }
    
    if (!gameDetail._id) {
      message.error('游戏ID不存在，无法进行复盘分析！');
      return;
    }

    if (checkingReplay) {
      return;
    }

    const messageKey = `replay-ready-${gameDetail._id}`;
    setCheckingReplay(true);
    message.loading({ content: '正在确认复盘文件状态...', key: messageKey, duration: 0 });
    try {
      const result = await waitForReplayReport(gameDetail._id, {
        timeoutMs: 60000,
        intervalMs: 3000,
        onWaiting: ({ elapsedMs }) => {
          const seconds = Math.max(1, Math.ceil(elapsedMs / 1000));
          message.loading({
            content: `复盘文件正在生成中，已等待 ${seconds} 秒，请稍候...`,
            key: messageKey,
            duration: 0,
          });
        },
      });

      if (result.ready) {
        message.success({ content: '复盘文件已生成，正在打开复盘页面...', key: messageKey, duration: 1 });
        window.location.href = buildReplayPageUrl(gameDetail._id);
        return;
      }

      if (result.timedOut) {
        message.warning({
          content: '复盘文件生成超时，请稍后再试；如果长时间没有生成，请重新触发复盘分析。',
          key: messageKey,
          duration: 6,
        });
        return;
      }

      message.error({
        content: `暂时无法确认复盘状态：${result.error || '请稍后重试'}`,
        key: messageKey,
        duration: 5,
      });
    } finally {
      setCheckingReplay(false);
    }
  };

  const nextStage = () => {
    const params = { roomId: gameDetail.roomId, gameId: gameDetail._id };
    if (!isOwner && canRoleNextStage) {
      params.role = currentRole;
    }

    confirm({
      title: "确定进入下一阶段吗？",
      okText: "确定",
      cancelText: "取消",
      onOk() {
        const stageApi = !isOwner && canRoleNextStage ? apiGame.userNextStage : apiGame.nextStage;
        stageApi(params).then(() => {
          message.success("操作成功！");
          getRoomDetail();
        });
      },
    });
  };

  const gameAgain = () => {
    confirm({
      title: "确定要再开一局游戏吗？",
      okText: "确定",
      cancelText: "取消",
      onOk() {
        apiGame.gameAgain({ roomId: gameDetail.roomId }).then(() => {
          message.success("创建成功！");
          clearGame();
        });
      },
    });
  };

  return (
    <>
      {gameDetail._id ? (
        <div
          onClick={() => {
            if (gameDetail.status === 2) {
              openReplayPage();
            } else {
              lookRecord();
            }
          }}
          className="btn-primary btn-record"
        >
          {gameDetail.status === 2 ? (checkingReplay ? "确认复盘" : "复盘") : "查看记录"}
        </div>
      ) : null}
      <div
        onClick={() => {
          getRoomDetail();
        }}
        className="btn-tag btn-refresh"
      >
        刷新页面
      </div>
      {gameDetail._id && (canNextStage || isOwner) ? (
        <>
          {canNextStage ? (
            <div
              onClick={() => {
                nextStage();
              }}
              className="btn-warning btn-next-stage"
            >
              下一阶段
            </div>
          ) : isOwner ? (
            <div
              onClick={() => {
                gameAgain();
              }}
              className="btn-success btn-next-stage"
            >
              再来一局
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
};

export default withRouter(inject("appStore")(observer(Btn)));
