import {useRef, useState} from 'react';
import {BACKUP_MAX_BYTES, parseStudyBackup, mergeStudyBackup, type StudyData} from './nhkBackup';

export default function NhkBackupPanel({data, onRestore, onExport}: {data: StudyData; onRestore: (value: StudyData) => boolean; onExport: () => void}) {
  const input = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<StudyData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const restore = () => {
    if (!incoming || busy) return;
    setBusy(true); setError('');
    try {
      const merged = mergeStudyBackup(data,incoming);
      // This download is initiated by the explicit confirmation click.
      onExport();
      if (!onRestore(merged)) throw new Error('浏览器未能写入恢复结果。没有确认成功，请保留导入前备份；不要清除网站数据。');
      setIncoming(null); setMessage('合并恢复成功，现有文章和回答已保留。');
    } catch (e) {setError(e instanceof Error ? e.message : '恢复失败，未确认写入。');}
    finally {setBusy(false);}
  };
  return <details className="nhk-backup-panel"><summary>备份与恢复</summary>
    <p>文章、收藏、练习回答和阅读位置仅保存在本浏览器。备份文件不会上传到服务器，请妥善保管。</p>
    <div className="nhk-backup-actions"><button onClick={onExport}>导出完整备份</button><button onClick={() => input.current?.click()} disabled={busy}>选择备份文件</button></div>
    <input ref={input} type="file" accept="application/json,.json" aria-label="选择学习备份" hidden onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
      const request = ++sequence.current; setIncoming(null); setError(''); setMessage(''); setBusy(true);
      try {
        if (file.size > BACKUP_MAX_BYTES) throw new Error('备份超过 10 MB，未导入。');
        const parsed = parseStudyBackup(await file.text());
        mergeStudyBackup(data, parsed);
        if (sequence.current === request) setIncoming(parsed);
      } catch(e) {if (sequence.current === request) setError(e instanceof Error ? e.message : '读取失败。');}
      finally {if (sequence.current === request) setBusy(false);}
    }}/>
    {busy && <p role="status">正在处理备份…</p>}
    {incoming && <section aria-label="恢复预览" className="nhk-restore-preview"><h2>确认合并这份备份</h2>
      <p>文件内有 {incoming.articles.length} 篇文章、{incoming.knowledge.length} 个收藏、{incoming.sessions.length} 次表达记录、{incoming.history.attempts.length} 次句子回想。</p>
      <p>不清空现有数据。同一 ID 下不同的回答会分别保留；重复导入相同备份不会重复添加。确认时会先下载当前数据作为恢复前备份。</p>
      <div className="nhk-backup-actions"><button className="calm-primary" disabled={busy} onClick={restore}>合并恢复（保留现有）</button><button disabled={busy} onClick={() => {sequence.current++;setIncoming(null);}}>取消恢复</button></div>
    </section>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </details>;
}
