import fs from 'fs';
import { CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';

const content = fs.readFileSync('src/utils/optimizedweights.ts', 'utf8');

const settingsRules = CODE_DEFAULT_CATEGORY_SETTINGS['bankers_jackpot'].rules;
const settingsDescs = settingsRules.map(r => r.description);
console.log('Rules in CODE_DEFAULT_CATEGORY_SETTINGS.bankers_jackpot:', settingsDescs.length);

const evalStart = content.indexOf("} else if (['bankers_jackpot', 'value_picks'].includes(evalCategoryId || categoryId)) {");
const evalEnd = content.indexOf("return {", evalStart);
const evalBlock = content.substring(evalStart, evalEnd);

const evalDescRegex = /rulesHit\.push\(\{\s*description:\s*"([^"]+)"/g;
const evalDescs: string[] = [];
let m: RegExpExecArray | null;
while ((m = evalDescRegex.exec(evalBlock)) !== null) {
  if (!evalDescs.includes(m[1])) {
    evalDescs.push(m[1]);
  }
}
console.log('Unique rules in evaluation block for BJ/VP:', evalDescs.length);

const inSettingsNotEval = settingsDescs.filter(d => !evalDescs.includes(d));
console.log('\nIn Settings but not in Eval Block (' + inSettingsNotEval.length + '):', inSettingsNotEval);

const inEvalNotSettings = evalDescs.filter(d => !settingsDescs.includes(d));
console.log('\nIn Eval Block but not in Settings (' + inEvalNotSettings.length + '):', inEvalNotSettings);
