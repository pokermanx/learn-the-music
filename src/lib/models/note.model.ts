export type Note = {
  id: string;
  name: string;
  legend: string;
  active?: boolean;
  isSharp?: boolean;
  showTheLine?: boolean;
  shift?: boolean;
  octave: number;
};

export type Chord = {
  name: string;
  description: string;
  notes: string[];
};
