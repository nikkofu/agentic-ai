import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export function installSkillPackage(repoUrl: string) {
  // 1. 解析 repoUrl，获取 repo name
  const match = repoUrl.match(/\/([^\/]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid repository URL');
  }
  const repoName = match[1];

  // 2. 设置目标目录 ~/.config/superpowers/skills/<repo-name>
  const targetDir = path.join(os.homedir(), '.config', 'superpowers', 'skills', repoName);

  // 3. 执行 Git clone repo 到目标目录
  if (!fs.existsSync(path.dirname(targetDir))) {
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  }
  
  execSync(`git clone ${repoUrl} ${targetDir}`, { stdio: 'inherit' });

  // 4. Validate SKILL.md exists in the repo
  if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) {
    throw new Error('SKILL.md not found in the repository');
  }

  // 5. 打印安装成功的提示
  console.log(`Successfully installed skill: ${repoName}`);
}
