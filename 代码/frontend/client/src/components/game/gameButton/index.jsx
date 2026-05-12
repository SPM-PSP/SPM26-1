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
    console.log('🔍 复盘按钮点击');
    console.log('📋 游戏详情:', gameDetail);
    
    if (gameDetail.status !== 2) {
      console.log('❌ 游戏未结束，状态:', gameDetail.status);
      message.error('游戏尚未结束，无法进行复盘分析！');
      return;
    }
    
    if (!gameDetail._id) {
      console.log('❌ 游戏ID为空');
      message.error('游戏ID不存在，无法进行复盘分析！');
      return;
    }
    
    console.log('✅ 开始复盘分析，游戏ID:', gameDetail._id);
    setReplayLoading(true);
    
    const params = {
      gameId: gameDetail._id,
      enableAI: false, // 可以根据需要开启AI分析
      outputDir: 'replay_analysis'
    };
    
    console.log('📤 发送复盘请求:', params);
    
    apiGame.gameReplay(params).then((response) => {
      console.log('📥 收到复盘响应:', response);
      setReplayLoading(false);
      
      if (response.result) {
        message.success('复盘分析完成！');
        
        // 可以在这里显示分析结果或下载文件
        console.log('复盘分析结果:', response.data);
        
        // 直接显示游戏记录和复盘分析
        if (response.data && response.data.gameRecord) {
          const gameRecord = response.data.gameRecord;
          const analysisFiles = response.data.analysisFiles;
          
          // 检查是否有分析文件，如果有则读取
          if (analysisFiles && analysisFiles.text) {
            fetch(`/api/game/replay/file?file=${analysisFiles.text}`)
              .then(res => res.text())
              .then(analysisText => {
                Modal.info({
                  title: '游戏复盘报告',
                  width: 800,
                  content: (
                    <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                      <h3>📋 游戏记录</h3>
                      <p>游戏ID: {gameRecord.game_id}</p>
                      <p>房间ID: {gameRecord.room_id}</p>
                      <p>游戏天数: {gameRecord.days}</p>
                      <p>胜利阵营: {gameRecord.winner === 1 ? '好人阵营' : gameRecord.winner === 2 ? '狼人阵营' : '未知'}</p>
                      
                      <h3>📊 复盘分析</h3>
                      <pre style={{whiteSpace: 'pre-wrap', fontSize: '12px'}}>
                        {analysisText}
                      </pre>
                      
                      <p><strong>分析文件:</strong> {analysisFiles.json}</p>
                    </div>
                  ),
                  okText: '确定'
                });
              })
              .catch(() => {
                // 如果读取文件失败，显示基本信息
                Modal.info({
                  title: '游戏复盘报告',
                  width: 600,
                  content: (
                    <div>
                      <h3>📋 游戏记录</h3>
                      <p>游戏ID: {gameRecord.game_id}</p>
                      <p>房间ID: {gameRecord.room_id}</p>
                      <p>游戏天数: {gameRecord.days}</p>
                      <p>胜利阵营: {gameRecord.winner === 1 ? '好人阵营' : gameRecord.winner === 2 ? '狼人阵营' : '未知'}</p>
                      
                      <h3>📊 复盘分析</h3>
                      <p>分析文件已生成: {analysisFiles.text}</p>
                    </div>
                  ),
                  okText: '确定'
                });
              });
          } else {
            // 没有分析文件时，只显示游戏记录
            Modal.info({
              title: '游戏复盘报告',
              width: 600,
              content: (
                <div>
                  <h3>📋 游戏记录</h3>
                  <p>游戏ID: {gameRecord.game_id}</p>
                  <p>房间ID: {gameRecord.room_id}</p>
                  <p>游戏天数: {gameRecord.days}</p>
                  <p>胜利阵营: {gameRecord.winner === 1 ? '好人阵营' : gameRecord.winner === 2 ? '狼人阵营' : '未知'}</p>
                  
                  <h3>📊 复盘分析</h3>
                  <p>暂无AI分析文件</p>
                </div>
              ),
              okText: '确定'
            });
          }
        }
      } else {
        console.log('❌ 复盘分析失败:', response);
        message.error('复盘分析失败：' + (response.errorMessage || '未知错误'));
      }
    }).catch((error) => {
      console.log('❌ 复盘请求失败:', error);
      setReplayLoading(false);
      message.error('复盘分析请求失败：' + error.message);
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
        apiGame.nextStage(params).then(() => {
          message.success("操作成功！");
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
