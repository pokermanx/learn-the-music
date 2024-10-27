import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Chord, Note } from '../lib/models/note.model';
import { NgxSliderModule, Options } from '@angular-slider/ngx-slider';
import { debounceTime, filter, interval, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import chordsData from '../lib/data/chords.json';
import { uniq } from 'lodash-es';

/**
 * TODO:
 * Configurable chords
 * Midi input
 * Wait for keypress before moving forward
 * Add Sharp/Flat setting to randomly insert
 */

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgxSliderModule, CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  notes: Note[] = [];

  // true - right hand, false - left hand
  hand!: boolean;
  simpleOctave!: boolean;
  chords!: boolean;
  tips!: boolean;
  timeoutValue!: number;
  options: Options = {
    floor: 200,
    ceil: 10000,
    step: 50,
  };

  sliderValueChanged$ = new Subject();
  questionInterval$!: Subscription;

  englishToSlavNoteNames = new Map([
    ['B', 'Сі'],
    ['A', 'Ля'],
    ['G', 'Соль'],
    ['F', 'Фа'],
    ['E', 'Мі'],
    ['D', 'Ре'],
    ['C', 'До'],
  ]);

  ngOnInit(): void {
    console.log(chordsData);
    this.loadSettings();

    this.sliderValueChanged$
      .pipe(
        debounceTime(500),
        filter((value) => typeof value === 'number')
      )
      .subscribe((value: number) => {
        this.saveSettings();
        this.startGameLoop(value);
      });

    this.sliderValueChanged$.next(this.timeoutValue);
  }

  onChangeChords() {
    this.saveSettings();
    this.startGameLoop(this.timeoutValue);
  }

  onChangeTips() {
    this.saveSettings();
  }

  onChangeSimpleOctave() {
    this.saveSettings();
    this.generateNotes();
  }

  onChangeHand() {
    this.saveSettings();
    this.generateNotes();
  }

  private loadSettings() {
    let settings;

    try {
      settings = JSON.parse(localStorage.getItem('settings')!);
    } catch (e) {
      console.warn(`Couldn't parse settings`);
    }

    this.timeoutValue = settings ? settings.timeoutValue : 1500;
    this.chords = settings ? settings.chords : false;
    this.hand = settings ? settings.hand : true;
    this.tips = settings ? settings.tips : true;
    this.simpleOctave = settings ? settings.simpleOctave : false;

    this.onChangeHand();
  }

  private saveSettings() {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        timeoutValue: this.timeoutValue,
        chords: this.chords,
        hand: this.hand,
        tips: this.tips,
        simpleOctave: this.simpleOctave,
      })
    );
  }

  private startGameLoop(intervalValue: number) {
    this.resetNotes();

    let lastNote: Note;
    let lastChord: Chord;

    if (this.questionInterval$) {
      this.questionInterval$.unsubscribe();
    }

    this.questionInterval$ = interval(intervalValue).subscribe(() => {
      let current;

      if (lastNote) {
        lastNote.active = false;
      }

      if (lastChord) {
        this.resetNotes();
      }

      if (this.chords) {
        do {
          current = chordsData[Math.floor(Math.random() * chordsData.length)];
        } while (lastChord && current && lastChord.name === current.name);

        // current = chordsData.find((x) => x.name === 'Gbmaj9')!;
        // current = chordsData.find((x) => x.name === 'A#dim')!;
        // current = chordsData.find((x) => x.name === 'F#m11')!;
        // current = chordsData.find((x) => x.name === 'Bb9sus')!;

        lastChord = current;
        this.setChord(current);
      } else {
        do {
          current = this.notes[Math.floor(Math.random() * this.notes.length)];
        } while (lastNote && current && lastNote.id === current.id);

        lastNote = current;

        if (current) {
          current.active = true;
        }
      }

      this.setTheLines();
      this.setShifts();
    });
  }

  private generateNotes() {
    this.notes = [];

    if (this.hand) {
      const startRange = this.simpleOctave ? 0 : 2;
      const endRange = this.simpleOctave ? -1 : -2;

      for (let i = startRange; i > endRange; i--) {
        Array.from(this.englishToSlavNoteNames.entries()).forEach(
          ([engName, slavName]) => {
            this.notes.push({
              id: engName + i,
              name: engName,
              octave: i,
              legend: slavName,
              showTheLine: false,
              active: false,
            });
          }
        );
      }

      if (!this.simpleOctave) {
        this.notes.shift();
      } else {
        this.notes.unshift({
          id: 'C-1',
          name: 'C',
          octave: 1,
          legend: 'До',
          showTheLine: false,
          active: false,
        });
      }
    } else {
      const startRange = this.simpleOctave ? 0 : 1;
      const endRange = this.simpleOctave ? -1 : -3;

      for (let i = startRange; i > endRange; i--) {
        Array.from(this.englishToSlavNoteNames.entries()).forEach(
          ([engName, slavName]) => {
            this.notes.push({
              id: engName + i,
              name: engName,
              octave: i,
              legend: slavName,
              showTheLine: false,
              active: false,
            });
          }
        );
      }

      if (!this.simpleOctave) {
        for (let i = 0; i < 3; i++) {
          this.notes.pop();
        }
      } else {
        this.notes.unshift({
          id: 'C1',
          name: 'C',
          octave: 1,
          legend: 'До',
          showTheLine: false,
          active: false,
        });
      }
    }

    console.log(this.notes);

    // const test = this.notes.find((x) => x.id === 'A1');
    // test!.active = true;
    // this.setTheLines();
  }

  private setTheLines() {
    this.notes.forEach((note) => {
      note.showTheLine = false;
    });

    const activeNotes = this.getAllIndexes(
      this.notes.map((x) => (x.active || false).toString()),
      'true'
    );

    const activeIndexes = uniq([
      Math.min(...activeNotes),
      Math.max(...activeNotes),
    ]);

    activeIndexes.forEach((activeIndex) => {
      if (this.hand) {
        const floor = this.notes.findIndex((note) => note.id === 'F1');
        const ceil = this.notes.findIndex((note) => note.id === 'E0');

        if (
          activeIndex === this.notes.length - 1 ||
          activeIndex === this.notes.length - 2
        ) {
          this.notes[this.notes.length - 1].showTheLine = true;
        }

        if (
          (activeIndex > floor && activeIndex < ceil) ||
          floor === -1 ||
          ceil === -1
        ) {
          return;
        }

        for (
          let i = activeIndex;
          activeIndex > ceil ? i > ceil : i < floor;
          activeIndex > ceil ? i-- : i++
        ) {
          this.notes[i].showTheLine = i % 2 === 1;
        }
      } else {
        const floor = this.notes.findIndex((note) => note.id === 'A0');
        const ceil = this.notes.findIndex((note) => note.id === 'G-1');

        if (activeIndex === 0 || activeIndex === 1) {
          this.notes[0].showTheLine = true;
        }

        if (
          (activeIndex > floor && activeIndex < ceil) ||
          floor === -1 ||
          ceil === -1
        ) {
          return;
        }

        for (
          let i = activeIndex;
          activeIndex > ceil ? i > ceil : i < floor;
          activeIndex > ceil ? i-- : i++
        ) {
          this.notes[i].showTheLine = i % 2 === 0;
        }
      }
    });
  }

  private setShifts() {
    const activeNotes = this.getAllIndexes(
      this.notes.map((x) => (x.active || false).toString()),
      'true'
    );

    let prev: number;
    const toShift = uniq(
      activeNotes.reduce((accum: number[], el: number) => {
        if (prev === undefined) {
          prev = el;
          return accum;
        }

        if (prev + 1 === el) {
          accum.push(prev, el);
        }

        prev = el;

        return accum;
      }, [])
    );

    toShift.forEach((index) => {
      if (index % 2 === 0) {
        this.notes[index].shift = true;
      }
    });
  }

  private setChord(chord: Chord) {
    console.log(chord);

    const rootIndex = this.getRoot(chord);
    let note: Note;
    let lastIndex: number;

    chord.notes.forEach((noteId, i) => {
      const isSharp = noteId.includes('#');

      if (i === 0) {
        note = this.notes[rootIndex];
        lastIndex = rootIndex;
      } else {
        const engName = isSharp ? noteId[0] : noteId;
        note = this.notes
          .toSpliced(lastIndex, Infinity)
          .findLast((x) => x.name === engName)!;
        lastIndex = this.notes.findIndex((x) => x.id === note.id);
      }

      note!.active = true;
      note!.isSharp = isSharp;
    });
  }

  private resetNotes() {
    this.notes.forEach((note) => {
      note.active = false;
      note.showTheLine = false;
      note.isSharp = false;
    });
  }

  private getRoot(chord: Chord) {
    const rootNote = chord.notes[0];
    const rootPositions = this.getAllIndexes(
      this.notes.map((x) => x.name),
      rootNote.includes('#') ? rootNote[0] : rootNote
    );

    const middleCPosiition = this.notes.findIndex((x) => x.id === 'C0');

    const closest = rootPositions.reduce((prev, curr) => {
      return Math.abs(curr - middleCPosiition) <
        Math.abs(prev - middleCPosiition)
        ? curr
        : prev;
    });

    return closest;
  }

  private getAllIndexes(arr: string[], val: string) {
    const indexes = [];
    let i = -1;
    while ((i = arr.indexOf(val, i + 1)) != -1) {
      indexes.push(i);
    }
    return indexes;
  }
}
