import React from "react";
import "./index.styl";
import { withRouter } from "react-router-dom";
import { inject, observer } from "mobx-react";
import apiGame from "@api/game";
import appConfig from "@config";
import helper from "@helper";

import { message, Modal } from "antd";

const { confirm } = Modal;

const buildReplayPageUrl = (gameId) => {
  const replayUrl = appConfig.replayUrl || `http://${window.location.hostname}:5173`;
  const url = new URL(replayUrl, window.location.href);
  url.searchParams.set("gameId", gameId);
  const token = helper.getToken();
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
};

const Btn = (props) => {
  const { appStore, roomDetail, gameDetail, lookRecord, getRoomDetail, clearGame } = props;
  const isOwner = roomDetail && roomDetail.owner === appStore.user.username;
  const currentRole = gameDetail.roleInfo ? gameDetail.roleInfo.role : null;
  const canRoleNextStage =
    gameDetail.status === 1 &&
    ((gameDetail.stage === 1 && currentRole === "predictor") ||
      (gameDetail.stage === 2 && currentRole === "wolf") ||
      (gameDetail.stage === 3 && currentRole === "witch"));
  const canOwnerNextStage = isOwner && gameDetail.status === 1;
  const canNextStage = canOwnerNextStage || canRoleNextStage;

  const openReplayPage = () => {
    if (gameDetail.status !== 2) {
      message.error('游戏尚未结束，无法进行复盘分析！');
      return;
    }
    
    if (!gameDetail._id) {
      message.error('游戏ID不存在，无法进行复盘分析！');
      return;
    }

    window.location.href = buildReplayPageUrl(gameDetail._id);
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
          {gameDetail.status === 2 ? "复盘" : "查看记录"}
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
