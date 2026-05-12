import React, { useMemo, useState } from "react";
import "./index.styl";

import { inject, observer } from "mobx-react";
import { withRouter } from "react-router-dom";

import apiRoom from "@api/room";
import apiGame from "@api/game";

import cls from "classnames";
import constants from "@common/constants";

import { Button, Input, message, Modal, Radio } from "antd";
import { PlusCircleOutlined, MinusCircleOutlined } from "@ant-design/icons";

const {
  witchSaveOptions,
  winConditionOptions,
  flatTicketOptions,
  playerCountOptions,
} = constants;

const Ready = (props) => {
  const { appStore, seat, roomDetail } = props;
  const { user } = appStore;
  const isOwner = roomDetail && roomDetail.owner === user.username;

  const [modifyModal, setModifyModal] = useState(false);
  const [newName, setNewName] = useState(null);

  const [settingModal, setSettingModal] = useState(false);

  const [gameSetting, setGameSetting] = useState({
    playerCount: 9,
    p1: 30,
    p2: 45,
    p3: 30,
    witchSaveSelf: 2,
    winCondition: 1,
    flatTicket: 1,
  });

  const [kick, setKick] = useState(false);

  const selectedPlayerCount = Number(gameSetting.playerCount || 9);

  const startSeatStats = useMemo(() => {
    if (!Array.isArray(seat) || seat.length < selectedPlayerCount) {
      return {
        canStart: false,
        humanCount: 0,
        autoAiCount: 0,
      };
    }
    const seatMap = {};
    seat.forEach((item) => {
      seatMap[item.key] = item;
    });
    let humanCount = 0;
    let autoAiCount = 0;
    for (let i = 1; i <= selectedPlayerCount; i++) {
      if (seatMap[i] && seatMap[i].player) {
        humanCount += 1;
      } else {
        autoAiCount += 1;
      }
    }
    return {
      canStart: humanCount > 0,
      humanCount,
      autoAiCount,
    };
  }, [seat, selectedPlayerCount]);
  const canStart = startSeatStats.canStart;

  const modifyName = () => {
    if (!newName || newName === "") {
      message.warn("新昵称不能为空");
      return;
    }
    apiRoom.modifyNameInRoom({ id: user._id, roomId: roomDetail._id, name: newName }).then(() => {
      message.success("修改成功");
      setModifyModal(false);
      setNewName(null);
    });
  };

  const seatIn = (index) => {
    apiRoom.seatIn({ id: roomDetail._id, position: index }).then(() => {
      message.success("入座成功");
    });
  };

  const kickPlayer = (item) => {
    if (!item.player) {
      message.warn("该位置没有坐人，请重新操作");
      return;
    }
    if (item.player.username === user.username) {
      message.warn("你不能踢自己");
      return;
    }

    apiRoom.kickPlayer({ id: roomDetail._id, position: item.key }).then(() => {
      message.success("踢人成功");
      setKick(false);
    });
  };

  const startGame = () => {
    if (!canStart) {
      message.warn(`前 ${selectedPlayerCount} 个座位至少需要 1 名真人玩家`);
      return;
    }
    apiGame.startGame({ id: roomDetail._id, setting: gameSetting }).then(() => {
      message.success("新游戏开始");
      setGameSetting((prev) => ({
        ...prev,
        p1: 30,
        p2: 45,
        p3: 30,
        witchSaveSelf: 2,
        winCondition: 1,
        flatTicket: 1,
      }));
    });
  };

  const gameSettings = () => {
    setSettingModal(true);
  };

  return (
    <div className="room-content-wrap">
      <div className="normal-title">桌面座位（点击空座位即可入座）：</div>
      <div className="desk-view-wrap mar-t5">
        {seat.map((item) => {
          return (
            <div key={item.key} className="seat-cell mar-5 FBH FBAC FBJC">
              {kick ? (
                <div className="FBH FBAC FBJC" onClick={() => { kickPlayer(item); }}>
                  <div
                    className={cls({
                      "seat-in": item.player,
                      "empty-seat": !item.player,
                    })}
                  >
                    {item.name}
                  </div>
                  {item.player ? (
                    <div className="cell-text seat-status mar-l5">
                      <Button className="color-red kick-btn">踢人</Button>
                    </div>
                  ) : (
                    <div className="cell-text seat-status mar-l5"> </div>
                  )}
                </div>
              ) : (
                <div className="FBH FBAC FBJC" onClick={() => { seatIn(item.key); }} style={{ cursor: "pointer" }}>
                  <div
                    className={cls({
                      "seat-in": item.player,
                      "empty-seat": !item.player,
                    })}
                  >
                    {item.name}
                  </div>
                  {item.player ? (
                    <div className="cell-text color-success seat-status mar-l5">{item.player.name}</div>
                  ) : (
                    <div className="cell-text color-red seat-status mar-l5">空缺</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="normal-title mar-t10">等待区（尚未入座的玩家）：</div>
      <div className="wait-content mar-t5 FBH">
        {(roomDetail.waitPlayer || []).map((item) => {
          return (
            <div className="wait-cell mar-10" key={"wait-cell" + item.username}>
              {item.name}
            </div>
          );
        })}
      </div>
      {isOwner ? (
        <div className="normal-title mar-t10">
          开局条件：前 {selectedPlayerCount} 个座位至少 1 名真人，缺少的 {startSeatStats.autoAiCount} 人将由 AI 自动补齐
        </div>
      ) : null}
      {isOwner ? (
        <Button
          size="large"
          className={cls({
            "btn-primary": canStart,
            "btn-info": !canStart,
            "mar-t10 full-btn": true,
          })}
          disabled={!canStart}
          onClick={() => {
            startGame();
          }}
        >
          开始游戏
        </Button>
      ) : null}
      {isOwner ? (
        <Button
          size="large"
          className={cls({
            "btn-success": true,
            "mar-t10 full-btn": true,
          })}
          onClick={() => {
            gameSettings();
          }}
        >
          游戏设置
        </Button>
      ) : null}
      {isOwner ? (
        <Button
          className={cls({
            "btn-danger": !kick,
            "btn-info": kick,
            "mar-t10 full-btn": true,
          })}
          size="large"
          onClick={() => {
            setKick(!kick);
          }}
        >
          {kick ? "取消踢人" : "踢人"}
        </Button>
      ) : null}
      <Button
        className="btn-warning mar-t10 full-btn"
        size="large"
        onClick={() => {
          setNewName("");
          setModifyModal(true);
        }}
      >
        修改昵称
      </Button>

      <div style={{ width: "100%", height: "100px" }} />

      <Modal
        title="修改昵称"
        centered
        className="modal-view-wrap"
        maskClosable={false}
        maskStyle={{
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
        visible={modifyModal}
        onOk={modifyName}
        okText="确认"
        cancelText="取消"
        onCancel={() => {
          setModifyModal(false);
          setNewName(null);
        }}
      >
        <div>
          <div className="item-cell FBH FBAC mar-b10">
            <div className="item-title">新昵称：</div>
            <Input
              className="item-cell-content"
              placeholder="请输入新昵称"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
              }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={<div className="setting-modal-title color-green">游戏设置</div>}
        centered
        className="modal-view-wrap"
        maskClosable={false}
        closable={false}
        width={500}
        maskStyle={{
          backgroundColor: "rgba(0,0,0,0.1)",
        }}
        visible={settingModal}
        footer={[
          <Button
            key="ok"
            className="btn-primary"
            onClick={() => {
              setSettingModal(false);
            }}
          >
            确定
          </Button>,
        ]}
      >
        <div className="settings">
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">开局人数：</div>
            <Radio.Group
              options={playerCountOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, playerCount: e.target.value }); }}
              value={gameSetting.playerCount}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">预言家行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p1: (gameSetting.p1 - 15 < 15 ? 15 : gameSetting.p1 - 15) }); }} />
              <div className="fake-input">{gameSetting.p1}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p1: gameSetting.p1 + 15 }); }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">狼人行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p2: (gameSetting.p2 - 15 < 15 ? 15 : gameSetting.p2 - 15) }); }} />
              <div className="fake-input">{gameSetting.p2}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p2: gameSetting.p2 + 15 }); }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">女巫行动时间(秒)：</div>
            <div className="FBH FBAC FBJC">
              <MinusCircleOutlined className="icon-font mar-r20" onClick={() => { setGameSetting({ ...gameSetting, p3: (gameSetting.p3 - 15 < 15 ? 15 : gameSetting.p3 - 15) }); }} />
              <div className="fake-input">{gameSetting.p3}</div>
            </div>
            <PlusCircleOutlined className="icon-font mar-l20" onClick={() => { setGameSetting({ ...gameSetting, p3: gameSetting.p3 + 15 }); }} />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">女巫是否能自救：</div>
            <Radio.Group
              options={witchSaveOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, witchSaveSelf: e.target.value }); }}
              value={gameSetting.witchSaveSelf}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">游戏胜利条件：</div>
            <Radio.Group
              options={winConditionOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, winCondition: e.target.value }); }}
              value={gameSetting.winCondition}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
          <div className="setting-cell FBH FBAC mar-b10">
            <div className="item-title">平票：</div>
            <Radio.Group
              options={flatTicketOptions}
              onChange={(e) => { setGameSetting({ ...gameSetting, flatTicket: e.target.value }); }}
              value={gameSetting.flatTicket}
              optionType="button"
              buttonStyle="solid"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default withRouter(inject("appStore")(observer(Ready)));
