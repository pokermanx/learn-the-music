export type MIDIInput = {
  connection: string;
  id: string;
  manufacturer: string;
  name: string;
  onmidimessage: Function;
  onstatechange: Function;
  state: string;
  type: string;
  version: string;
};
