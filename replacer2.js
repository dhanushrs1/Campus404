const fs = require('fs');

const file = fs.readFileSync('client/src/pages/workspace/LabCurriculum.jsx', 'utf8');

const regex = /<div className="lc-modules">([\s\S]*?)<\/main>/;

const newString = `<div className="lc-modules-grid">
            {lab.modules.map((mod, idx) => {
              const modPct = mod.challenge_count > 0 ? Math.round((mod.completed_challenges / mod.challenge_count) * 100) : 0;
              const earnedBadge = mod.badge?.earned_at;

              return (
                <div
                  key={mod.module_id}
                  className={\`lc-mod-card \${mod.is_locked ? 'locked' : ''} \${mod.is_completed ? 'completed' : ''}\`}
                  onClick={() => !mod.is_locked && navigate(\`/labs/\${slug}/modules/\${mod.module_id}\`)}
                >
                  <div className="lc-mod-card-header">
                    <span className="lc-mod-num">{mod.is_locked ? '🔒' : idx + 1}</span>
                  </div>
                  
                  <h3 className="lc-mod-title">{mod.title}</h3>
                  {mod.description && <p className="lc-mod-desc">{mod.description}</p>}
                  
                  <div className="lc-mod-meta">
                    <div className="lc-mod-stat">{mod.challenge_count} Challenges</div>
                    <div className="lc-mod-stat">{mod.total_xp} XP</div>
                  </div>

                  {!mod.is_locked && (
                    <div className="lc-mod-pbar">
                      <div className="lc-mod-pfill" style={{ width: \`\${modPct}%\` }} />
                    </div>
                  )}
                  
                  {earnedBadge && (
                     <div className="lc-mod-earned-badge">
                        {mod.badge.image_url ? (
                           <img src={mod.badge.image_url} alt={mod.badge.name} className="lc-badge-chip-img" />
                        ) : '🏆'}
                        <span>Earned!</span>
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>`;

if (regex.test(file)) {
  const newFile = file.replace(regex, newString);
  fs.writeFileSync('client/src/pages/workspace/LabCurriculum.jsx', newFile);
  console.log("Success");
} else {
  console.log("Could not find match");
}
