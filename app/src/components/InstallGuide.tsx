import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, setSetting } from '../db';
import { isIOS, isStandalone, shouldShowInstallGuide } from '../lib/platform';

/** iPhone only: reminders and safe storage need Rea on the Home Screen (iOS 16.4+). */
export function InstallGuide({ always = false, className = '' }: { always?: boolean; className?: string }) {
  const dismissed = useLiveQuery(() => getSetting('installGuideDismissed', false), [], true);
  const [hidden, setHidden] = useState(false);
  const ios = isIOS(), standalone = isStandalone();
  if (hidden || !shouldShowInstallGuide(ios, standalone, always ? false : Boolean(dismissed))) return null;
  return (
    <section className={`panel install ${className}`} aria-labelledby="install-h">
      <h2 id="install-h">Add Rea to your Home Screen</h2>
      <p>On iPhone, reminders only reach you when Rea is opened from the Home Screen. It also keeps your data safe from Safari’s clean-up.</p>
      <ol>
        <li>Tap the Share button in Safari’s toolbar.</li>
        <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open Rea from its new icon and turn on notifications in Settings.</li>
      </ol>
      {!always && (
        <div><button className="btn small quiet" onClick={() => { setSetting('installGuideDismissed', true); setHidden(true); }}>Not now</button></div>
      )}
    </section>
  );
}
