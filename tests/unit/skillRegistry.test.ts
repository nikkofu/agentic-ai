import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installSkillPackage } from '../../src/cli/skillRegistry';
import * as child_process from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('child_process');
vi.mock('fs');
vi.mock('os');

describe('skillRegistry', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/Users/testuser');
  });

  it('should parse repo url, clone it, and validate SKILL.md', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    installSkillPackage('https://github.com/user/my-skill.git');

    const expectedDir = path.join('/Users/testuser', '.config', 'superpowers', 'skills', 'my-skill');
    
    expect(child_process.execSync).toHaveBeenCalledWith(
      `git clone https://github.com/user/my-skill.git ${expectedDir}`,
      expect.anything()
    );

    expect(fs.existsSync).toHaveBeenCalledWith(path.join(expectedDir, 'SKILL.md'));
  });

  it('should throw if SKILL.md does not exist after cloning', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => {
      installSkillPackage('https://github.com/user/invalid-skill');
    }).toThrow(/SKILL\.md not found/);
  });
});
