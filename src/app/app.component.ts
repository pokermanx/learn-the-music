import { Component, EventEmitter, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Chord, Note } from '../lib/models/note.model';
import {
  LabelType,
  NgxSliderModule,
  Options,
} from '@angular-slider/ngx-slider';
import {
  debounceTime,
  filter,
  interval,
  startWith,
  Subject,
  Subscription,
} from 'rxjs';
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
  activeNotes: Note[] = [];
  layout: Note[] = [];

  // true - right hand, false - left hand
  hand!: boolean;
  chords!: boolean;
  tips!: boolean;
  timeoutValue!: number;

  floorNote!: number;
  ceilNote!: number;

  intervalSliderOptions: Options = {
    floor: 200,
    ceil: 10000,
    step: 50,
  };
  octaveSliderOptions: Options = {
    floor: 1,
    ceil: 28,
    step: 1,
    vertical: true,
    showTicks: true,
    rightToLeft: true,
    translate: (value: number, label: LabelType): string => {
      return this.layout[value - 1].legend;
    },
    getLegend: (value: number): string => {
      return value % 7 === 2 ? this.layout[value - 1].octave.toString() : '';
    },
  };
  manualRefresh: EventEmitter<void> = new EventEmitter<void>();

  sliderValueChanged$ = new Subject();
  noteRangeValueChanged$ = new Subject();

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
    this.generateLayout();
    this.generateNotes();

    this.sliderValueChanged$
      .pipe(
        debounceTime(500),
        filter((value) => typeof value === 'number')
      )
      .subscribe((value: number) => {
        this.saveSettings();
        this.startGameLoop(value);
      });

    this.noteRangeValueChanged$.pipe(debounceTime(400)).subscribe(() => {
      this.saveSettings();
      this.generateNotes();
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
    this.generateLayout();
    this.generateNotes();
    this.manualRefresh.emit();
  }

  private loadSettings() {
    let settings;

    try {
      settings = JSON.parse(localStorage.getItem('settings')!);
    } catch (e) {
      console.warn(`Couldn't parse settings`);
    }
    this.timeoutValue = this.checkSettingExists(settings, 'timeoutValue')
      ? settings.timeoutValue
      : 1500;
    this.chords = this.checkSettingExists(settings, 'chords')
      ? settings.chords
      : false;
    this.hand = this.checkSettingExists(settings, 'hand')
      ? settings.hand
      : true;
    this.tips = this.checkSettingExists(settings, 'tips')
      ? settings.tips
      : true;
    this.floorNote = this.checkSettingExists(settings, 'floorNote')
      ? settings.floorNote
      : 14;
    this.ceilNote = this.checkSettingExists(settings, 'ceilNote')
      ? settings.ceilNote
      : 21;
  }

  private checkSettingExists(settings: any, settingName: string) {
    return settings && settings[settingName] !== undefined;
  }

  private saveSettings() {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        timeoutValue: this.timeoutValue,
        chords: this.chords,
        hand: this.hand,
        tips: this.tips,
        floorNote: this.floorNote,
        ceilNote: this.ceilNote,
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

    this.questionInterval$ = interval(intervalValue)
      .pipe(startWith(0))
      .subscribe(() => {
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
          } while (
            this.activeNotes.length !== 1 &&
            lastChord &&
            current &&
            lastChord.name === current.name
          );

          // current = chordsData.find((x) => x.name === 'Gbmaj9')!;
          // current = chordsData.find((x) => x.name === 'A#dim')!;
          // current = chordsData.find((x) => x.name === 'F#m11')!;
          // current = chordsData.find((x) => x.name === 'Bb9sus')!;

          lastChord = current;
          this.setChord(current);
        } else {
          do {
            current =
              this.activeNotes[
                Math.floor(Math.random() * this.activeNotes.length)
              ];
          } while (
            this.activeNotes.length !== 1 &&
            lastNote &&
            current &&
            lastNote.id === current.id
          );

          lastNote = current;

          if (current) {
            current.active = true;
          }
        }

        this.setTheLines();
        this.setShifts();
      });
  }

  private generateLayout() {
    this.layout = [];

    if (this.hand) {
      for (let i = 2; i > -2; i--) {
        Array.from(this.englishToSlavNoteNames.entries()).forEach(
          ([engName, slavName]) => {
            this.layout.push({
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
    } else {
      for (let i = 1; i > -3; i--) {
        Array.from(this.englishToSlavNoteNames.entries()).forEach(
          ([engName, slavName]) => {
            this.layout.push({
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

      // Plug for bass
      for (let note of [
        { name: 'C', octave: 2 },
        { name: 'D', octave: 2 },
      ]) {
        this.layout.pop();
        this.layout.unshift({
          id: note.name + note.octave,
          name: note.name,
          octave: note.octave,
          legend: this.englishToSlavNoteNames.get(note.name)!,
          showTheLine: false,
          active: false,
        });
      }
    }

    console.log('Layout: ', this.layout);

    // const test = this.notes.find((x) => x.id === 'A1');
    // test!.active = true;
    // this.setTheLines();
  }

  private generateNotes() {
    this.activeNotes = this.layout.slice(this.floorNote - 1, this.ceilNote);
    console.log('Active notes: ', this.activeNotes);
  }

  private setTheLines() {
    this.layout.forEach((note) => {
      note.showTheLine = false;
    });

    const activeNotes = this.getAllIndexes(
      this.layout.map((x) => (x.active || false).toString()),
      'true'
    );

    const activeIndexes = uniq([
      Math.min(...activeNotes),
      Math.max(...activeNotes),
    ]);

    activeIndexes.forEach((activeIndex) => {
      let ceil: number;
      let floor: number;

      if (this.hand) {
        floor = this.layout.findIndex((note) => note.id === 'F1');
        ceil = this.layout.findIndex((note) => note.id === 'E0');
      } else {
        floor = this.layout.findIndex((note) => note.id === 'A0');
        ceil = this.layout.findIndex((note) => note.id === 'G-1');
      }

      if (activeIndex > floor && activeIndex < ceil) {
        return;
      }

      for (
        let i = activeIndex;
        activeIndex > ceil ? i > ceil : i < floor;
        activeIndex > ceil ? i-- : i++
      ) {
        this.layout[i].showTheLine = i % 2 === 0;
      }
    });
  }

  private setShifts() {
    const activeNotes = this.getAllIndexes(
      this.layout.map((x) => (x.active || false).toString()),
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
        this.layout[index].shift = true;
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
        note = this.layout[rootIndex];
        lastIndex = rootIndex;
      } else {
        const engName = isSharp ? noteId[0] : noteId;
        note = this.layout
          .toSpliced(lastIndex, Infinity)
          .findLast((x) => x.name === engName)!;
        lastIndex = this.layout.findIndex((x) => x.id === note.id);
      }

      note!.active = true;
      note!.isSharp = isSharp;
    });
  }

  private resetNotes() {
    this.layout.forEach((note) => {
      note.active = false;
      note.showTheLine = false;
      note.isSharp = false;
      note.shift = false;
    });
  }

  private getRoot(chord: Chord) {
    const rootNote = chord.notes[0];
    const rootPositions = this.getAllIndexes(
      this.layout.map((x) => x.name),
      rootNote.includes('#') ? rootNote[0] : rootNote
    );

    const middleCPosiition = this.layout.findIndex((x) => x.id === 'C0');

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
