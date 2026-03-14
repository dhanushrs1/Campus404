const fs = require('fs');
const oldStr = fs.readFileSync('oldstring.txt', 'utf8');

const newStr = `          <div className="lc-section-label">
            <span>Course Modules</span>
            <span className="lc-section-count">{lab.modules.length} modules</span>
          </div>

          <div className="lc-modules-grid">
            {lab.modules.map((mod, idx) => {
              const modPct = mod.total_xp > 0 ? Math.round((mod.earned_xp / mod.total_xp) * 100) : 0;
              const earnedBadge = mod.badge?.earned_at;

              return (
                <div
                  key={mod.module_id}
                  className={\`lc-mod-card \${mod.is_locked ? 'locked' : ''} \${mod.is_completed ? 'completed' : ''}\`}
                  onClick={() => !mod.is_locked && navigate(\`/workspace/labs/\${slug}/modules/\${mod.module_id}\`)}
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
`;

let targetFile = fs.readFileSync('client/src/pages/workspace/LabCurriculum.jsx', 'utf8');
targetFile = targetFile.replace(oldStr, newStr);
fs.writeFileSync('client/src/pages/workspace/LabCurriculum.jsx', targetFile);
console.log('replaced successfully');
