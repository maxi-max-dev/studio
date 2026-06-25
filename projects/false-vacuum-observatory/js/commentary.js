'use strict';

const COMMENTARY = {
  birth: [
    "一个宇宙在虚空中凝聚。",
    "此刻，它以为自己是永恒的。",
    "但所有的稳定，不过是等待。",
  ],
  stable: [
    "粒子在假真空中聚集、旋转，未知地板并不稳固。",
    "量子隧穿随时可能发生——只是概率的问题。",
    "这片宁静，叫做亚稳态。",
    "假真空中的秩序，是借来的时间。",
    "一切的物理常数，只是这个真空态的参数。",
    "真空泡不需要理由。它等待时机。",
  ],
  nucleation: [
    "核化。某一点的量子涨落，穿越了势垒。",
    "真空泡诞生，以光速向外扩张——无法阻止。",
    "在泡内：一套新的物理定律正在形成。",
    "边界之外的宇宙，尚不知情。光还没赶到。",
  ],
  dying: [
    "这个宇宙的倒计时已经开始。",
    "在真空泡内部，也许有另一套秩序在萌芽。",
    "消逝与诞生，是同一件事。",
    "任何东西都无法从那道边界逃脱。",
  ],
  rebirth: [
    "灰烬冷却。一个新的宇宙从中重建。",
    "它也以为自己是永恒的。",
  ],
};

class Commentary {
  constructor(el) {
    this.el = el;
    this._hideTimer = null;
    this._seqTimer = null;
    this._stableIndex = 0;
    this._lastStableAge = 0;
    this._activeCategory = null;
  }

  show(category) {
    const lines = COMMENTARY[category];
    if (!lines || !lines.length) return;

    this._activeCategory = category;
    clearTimeout(this._seqTimer);

    let i = 0;
    const next = () => {
      if (this._activeCategory !== category) return;
      this._display(lines[i++]);
      if (i < lines.length) {
        this._seqTimer = setTimeout(next, 5400);
      }
    };
    next();
  }

  trigger(eventType, universeAge) {
    const directMap = { nucleation: 'nucleation', dying: 'dying', rebirth: 'rebirth' };
    const cat = directMap[eventType];
    if (cat) {
      this.show(cat);
      return;
    }

    // Periodic ambient commentary during stable phase — don't interrupt active sequences
    if (eventType === 'tick' &&
        this._activeCategory !== 'dying' &&
        this._activeCategory !== 'nucleation' &&
        this._activeCategory !== 'rebirth' &&
        universeAge > 900 && universeAge - this._lastStableAge > 800) {
      this._lastStableAge = universeAge;
      const lines = COMMENTARY.stable;
      this._display(lines[this._stableIndex % lines.length]);
      this._stableIndex++;
    }
  }

  _display(text) {
    const el = this.el;
    clearTimeout(this._hideTimer);

    // Fade out (0.9s CSS transition), swap text, fade in
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = text;
      el.style.opacity = '1';
      this._hideTimer = setTimeout(() => {
        el.style.opacity = '0';
      }, 4600);
    }, 950);
  }
}
