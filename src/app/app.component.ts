import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Note } from '../lib/models/note.model';
import { NgxSliderModule, Options } from '@angular-slider/ngx-slider';
import { debounceTime, filter, interval, Subject, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import chordsData from '../lib/data/chords.json';

/**
 * TODO:
 * Just one octave setting
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
    let last: Note;

    this.sliderValueChanged$
      .pipe(
        debounceTime(500),
        filter((value) => typeof value === 'number')
      )
      .subscribe((value: number) => {
        if (this.questionInterval$) {
          this.questionInterval$.unsubscribe();
        }

        this.questionInterval$ = interval(value).subscribe(() => {
          let current;

          do {
            current = this.notes[Math.floor(Math.random() * this.notes.length)];
          } while (last && current && last.id === current.id);

          if (last) {
            last.active = false;
          }

          last = current;

          if (current) {
            current.active = true;
          }
          this.setTheLines();
        });

        this.saveSettings();
      });

    this.sliderValueChanged$.next(this.timeoutValue);
  }

  onChangeChords() {
    this.saveSettings();
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

    const activeIndex = this.notes.findIndex((note) => note.active);

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
  }
}
