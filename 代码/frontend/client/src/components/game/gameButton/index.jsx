import React, { useState } from "react";
import "./index.styl";
import { withRouter } from "react-router-dom";
import { inject, observer } from "mobx-react";
import apiGame from "@api/game";

import { message, Modal, Button } from "antd";

const { confirm } = Modal;

const Btn = (props) => {
  const { appStore, roomDetail, gameDetail, lookRecord, getRoomDetail, clearGame } = props;
  const isOwner = roomDetail && roomDetail.owner === appStore.user.username;
  const currentRole = gameDetail.roleInfo ? gameDetail.roleInfo.role : null;
  const [replayLoading, setReplayLoading] = useState(false);
  const canRoleNextStage =
    gameDetail.status === 1 &&
    ((gameDetail.stage === 1 && currentRole === "predictor") ||
      (gameDetail.stage === 2 && currentRole === "wolf") ||
      (gameDetail.stage === 3 && currentRole === "witch"));
  const canOwnerNextStage = isOwner && gameDetail.status === 1;
  const canNextStage = canOwnerNextStage || canRoleNextStage;

  // 复盘分析功能
  const analyzeReplay = () => {
    if (gameDetail.status !== 2) {
      message.error('游戏尚未结束，无法进行复盘分析！');
      return;
    }
    
    if (!gameDetail._id) {
      message.error('游戏ID不存在，无法进行复盘分析！');
      return;
    }
    
    setReplayLoading(true);
    
    const params = {
      gameId: gameDetail._id,
    };
    
    apiGame.gameReplay(params).then((data) => {
      setReplayLoading(false);
      message.success((data && data.message) || '复盘分析完成！');
      
      const result = (data && data.result) || data || {};
      const gameRecord = result.gameRecord || result.game_record || {};
      const analysisFiles = result.analysisFiles || result.analysis_files || {};
      const filePath = analysisFiles.text || analysisFiles.path || result.textPath || result.path;

      const openReplayModal = (analysisText) => {
        Modal.info({
          title: '游戏复盘报告',
          width: 800,
          content: (
            <div style={{maxHeight: '500px', overflowY: 'auto'}}>
              <h3>游戏记录</h3>
              <p>游戏ID: {gameRecord.game_id || gameDetail._id}</p>
              {gameRecord.room_id || gameDetail.roomId ? <p>房间ID: {gameRecord.room_id || gameDetail.roomId}</p> : null}
              {gameRecord.days ? <p>游戏天数: {gameRecord.days}</p> : null}
              {gameRecord.winner !== undefined ? <p>胜利阵营: {gameRecord.winner === 1 ? '好人阵营' : gameRecord.winner === 0 ? '狼人阵营' : '未知'}</p> : null}
              
              <h3>复盘分析</h3>
              <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px'}}>
                {analysisText || JSON.stringify(result, null, 2)}
              </pre>
              
              {analysisFiles.json ? <p><strong>分析文件:</strong> {analysisFiles.json}</p> : null}
            </div>
          ),
          okText: '确定'
        });
      };

      if (filePath) {
        fetch(`/api/game/replay/file?path=${encodeURIComponent(filePath)}`)
          .then(res => res.text())
          .then(openReplayModal)
          .catch(() => {
          openReplayModal('')
        });
        return;
      }
      openReplayModal('');
    }).catch((error) => {
      setReplayLoading(false);
      message.error('复盘分析请求失败：' + (error.message || error));
    });
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
              analyzeReplay();
            } else {
              lookRecord();
            }
          }}
          className="btn-primary btn-record"
          loading={replayLoading}
        >
          {replayLoading ? "分析中..." : (gameDetail.status === 2 ? "复盘" : "查看记录")}
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
