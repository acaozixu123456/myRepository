// 后台线程：算“捏”出来的人的形状（sculptGeo.js），算好把一堆数交回去
import { sculptData } from './sculptGeo.js';

self.onmessage = e => {
  const { id, arms, BI, opts } = e.data;
  try {
    const d = sculptData(arms, BI, opts);
    self.postMessage({ id, d }, [d.pos.buffer, d.nor.buffer, d.col.buffer, d.glow.buffer, d.si.buffer, d.sw.buffer, d.idx.buffer]);
  } catch (err) { self.postMessage({ id, err: String(err && err.message || err) }); }
};
