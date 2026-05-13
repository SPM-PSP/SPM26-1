import React from "react";
import "./index.styl";

import hunterImg from "@assets/images/identity/hunter.png";
import witchImg from "@assets/images/identity/witch.png";
import wolfImg from "@assets/images/identity/wolf.png";
import predictorImg from "@assets/images/identity/predictor.png";
import villagerImg from "@assets/images/identity/villager.png";
import wolfBg from "@assets/images/identity/wolf-bg.png";
import defaultAvatar from "@assets/images/avator/default.png";

const roleTheme = {
  hunter: {
    image: hunterImg,
    roleName: "猎人",
    mark: "秋日森林的守望者",
    title: "你的灵魂已被",
    accentText: "召唤",
    desc: "日志已经开启，你不再是这片森林的陌生人。在这个夜晚，你将扮演猎人。",
    quote: "枪响之时，即是黎明之前。他的目光穿透迷雾，直抵真相。",
    loreTitle: "第0晚：蛰伏",
    lore: "枯叶在靴底碎裂。你检查着子弹，感受着空气中不安的震颤。有些猎物，比野狼更危险。",
    bg: "https://lh3.googleusercontent.com/aida-public/AB6AXuDRl1c_zVF1tSxXOFBq6tg1CSGL_emXB-LRH9XYN5BgamM2PPD8z5AboyxiUcMu3lDBVGRrRawPefmUhrXoShdwVpgficwqH4hn7RTl8Rx6RQJQGO3sOp3bOKcSQB9IabV4XnlkTepaFs14JU7v0kFTDTdxOqvX1b3AUyLZ4sbkt4uR0vV4RLUV5T71gxzaBnrNfvHzKpoe8xos4MQDkceV4vauxWnZTCX8kX5mMQKWdxOpbHwznszike7cuvL6toYl_xysMUCV4T4",
    tone: "amber",
    stats: [
      { label: "射击精度", value: 95 },
      { label: "追踪本能", value: 76 },
    ],
  },
  witch: {
    image: witchImg,
    roleName: "女巫",
    mark: "秘药与月光的守护者",
    title: "你的灵魂已被",
    accentText: "召唤",
    desc: "药瓶轻响，夜色回应。你将以女巫的身份守住生死边界。",
    quote: "一滴救赎，一滴审判。她在沉默里称量每个人的命运。",
    loreTitle: "第0晚：药柜开启",
    lore: "玻璃瓶映出烛火，你听见远处狼群低鸣。今晚，每一次选择都可能改写村庄的结局。",
    bg: "https://lh3.googleusercontent.com/aida-public/AB6AXuDED-sosttRc0LJvP2lvxoHSyU-R3cZWuk0O6XJvVOwH0AoGItMY_4pkWHye6LfEXKj3GWpkjvBQnGJg_1QLhxGs7062W22vuRtCxV2VdSrYE4ybZuHNd15MiWtT-yqPPdMb7q73GY2QOzDDsWvuT9M-OQ--PtC3Qcjx4--A6yXmAEjU9lM5EzKAT-IBiVPylHd0I4zvhLlNBtp_ueFsRJmvkji1Zz9mN-8R2vLdNCibykrQ9uBLYAAdKXKOiqRLXMzAkbWQt_qqOI",
    tone: "green",
    stats: [
      { label: "解药余量", value: 100 },
      { label: "毒药威慑", value: 88 },
    ],
  },
  wolf: {
    image: wolfImg,
    roleName: "狼人",
    mark: "暗林里的低语者",
    title: "你的野心已被",
    accentText: "唤醒",
    desc: "阴影为你让路。你将隐藏在人群中，等待黑夜递来锋利的机会。",
    quote: "白日里保持微笑，夜晚让爪痕替你发言。",
    loreTitle: "第0晚：獠牙藏起",
    lore: "你记下每一张脸，也记下每一次迟疑。黎明之前，村庄还不知道危险已经入席。",
    bg: wolfBg,
    tone: "crimson",
    stats: [
      { label: "伪装能力", value: 91 },
      { label: "夜袭本能", value: 94 },
    ],
  },
  predictor: {
    image: predictorImg,
    roleName: "预言家",
    mark: "星象与真相的凝视者",
    title: "命运的丝线已",
    accentText: "浮现",
    desc: "星光落进掌心。你将以预言家的身份看穿阵营，替村庄寻找隐藏的裂缝。",
    quote: "水晶球不会说谎，但人会。她只负责把迷雾照亮。",
    loreTitle: "第0晚：观星",
    lore: "你展开旧羊皮纸，星轨像细线一样缠绕村庄。第一道真相，即将被你轻轻拨开。",
    bg: "https://lh3.googleusercontent.com/aida-public/AB6AXuCM2oFiWeNw_HWaY3CC0AGTNxCuhiiOoEcG0BOq8jkjnCDoP_P4vP8y7WZP-rhA4mVSrUypyrwS70ydV4xItC-x3KxiadUL0HHKui4bxIn09dzO61Gxqb2zI2CKJVX_kSGJPLg-OUZq7m5dFqyN4H4vFfzxP5wnR_yMnp1zYubw289SZlqpYREUwF3DcV0udc_UwI3HXEGgBHiKPq7IdH8Wcvf5cVNCgAYQQFeN8EYBpv89lxmTOeULc7pi7lm2A44-3BSplQGtlHA",
    tone: "violet",
    stats: [
      { label: "洞察强度", value: 96 },
      { label: "迷雾抗性", value: 82 },
    ],
  },
  villager: {
    image: villagerImg,
    roleName: "村民",
    mark: "炉火边的普通人",
    title: "你的命运与村庄",
    accentText: "相连",
    desc: "你没有神迹，也没有利爪。但每一次发言和投票，都可能托住整个村庄。",
    quote: "普通并不意味着弱小。真相常常从安静的人群中站起来。",
    loreTitle: "第0晚：守灯",
    lore: "窗外的雾贴着田埂移动，你把门闩扣紧。活到天亮，然后说出你看见的破绽。",
    bg: "https://lh3.googleusercontent.com/aida-public/AB6AXuCQcLZYu_GntAw3jfNd7b2bdT99ZmaF9IPY3ep2jIwNudjnZiQyi63RbAdx5Gw_jG-8-ZMLdmmflZnhI8oYl-Cr6M88nVO4586zrQNebttysqhMXXJBEw5AVUE49vyfSjrgxEpB9o-qm9bl_feLBsRSsdWif5f21i1OqSTq80ErEaXJUlv2NxOoA8OYxgX9-D-trjVesNMrkLpZmNS3xZ2WIG2FDFx4ST3bgho4Ct5XjCg714_UiLfPsURLxR560NPzl5F3YqrZfRM",
    tone: "meadow",
    stats: [
      { label: "可信直觉", value: 72 },
      { label: "生存韧性", value: 89 },
    ],
  },
}

const IdentityReveal = (props) => {
  const { visible, roleInfo, onClose } = props
  if (!visible || !roleInfo) {
    return null
  }

  const theme = roleTheme[roleInfo.role] || roleTheme.villager

  return (
    <div className={"identity-reveal identity-reveal-" + theme.tone}>
      <div className="identity-bg-gradient" />
      <div className="identity-bg-image" style={{ backgroundImage: "url(" + theme.bg + ")" }} />
      <div className="identity-bg-grain" />
      <div className="identity-mote identity-mote-a" />
      <div className="identity-mote identity-mote-b" />
      <div className="identity-mote identity-mote-c" />

      <header className="identity-topbar">
        <div className="identity-brand-mark">月</div>
        <div className="identity-brand-name">月夜审判</div>
      </header>

      <main className="identity-main">
        <section className="identity-card-shell">
          <div className="identity-card-glow" />
          <div className="identity-card">
            <div className="identity-card-inner">
              <div className="identity-card-head">
                <span className="identity-crosshair" />
                <span>身份已揭示</span>
                <span className="identity-crosshair" />
              </div>

              <div className="identity-portrait">
                <img
                  src={theme.image}
                  alt={theme.roleName}
                  onError={(event)=>{
                    event.currentTarget.src = defaultAvatar
                  }}
                />
                <div className="identity-role-banner">
                  <span>{theme.roleName}</span>
                </div>
              </div>

              <div className="identity-flavor">
                <p>{theme.quote}</p>
                <div className="identity-stats">
                  {theme.stats.map(item => (
                    <div className="identity-stat" key={item.label}>
                      <div className="identity-stat-label">{item.label}</div>
                      <div className="identity-stat-row">
                        <div className="identity-stat-track">
                          <div className="identity-stat-fill" style={{ width: item.value + "%" }} />
                        </div>
                        <span>{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="identity-copy">
          <div className="identity-chip">
            <span className="identity-chip-icon" />
            <span>{theme.mark}</span>
          </div>
          <h2>
            {theme.title}
            <br />
            <em>{theme.accentText}</em>
          </h2>
          <p className="identity-desc">
            {theme.desc}
          </p>

          <div className="identity-actions">
            <button type="button" className="identity-primary-btn" onClick={onClose}>
              <span>进入村庄</span>
              <span className="identity-arrow">→</span>
            </button>
            <button type="button" className="identity-ghost-btn" onClick={onClose}>
              <span className="identity-scroll-icon" />
              <span>阅读预言</span>
            </button>
          </div>

          <div className="identity-lore">
            <div className="identity-lore-icon" />
            <div>
              <h3>{theme.loreTitle}</h3>
              <p>{theme.lore}</p>
            </div>
          </div>
        </section>
      </main>

      <button type="button" className="identity-close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}

export default IdentityReveal
