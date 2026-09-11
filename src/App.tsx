import {NhkStudyTools} from './immersion/NhkStudyTools';
import NhkMorningPage from './NhkMorningPage';

function App() {
  return (
    <div className="shell">
      <main className="phone focus-app nhk-only-app">
        <nav aria-label="应用入口" style={{padding:"8px 18px",fontSize:13}}><a href="/companion.html" style={{color:"#245342"}}>← HITOKOTO 日语陪聊</a></nav>
        <NhkMorningPage />
        <NhkStudyTools />
      </main>
    </div>
  );
}

export default App;
