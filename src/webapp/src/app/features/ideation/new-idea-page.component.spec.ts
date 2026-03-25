import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BusinessIdeasApiService } from '../../core/services/business-ideas-api.service';
import { NewIdeaPageComponent } from './new-idea-page.component';

describe('NewIdeaPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewIdeaPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessIdeasApiService,
          useValue: {
            listBusinessIdeas: () => Promise.resolve([]),
            createBusinessIdea: () => Promise.reject(new Error('not implemented'))
          }
        }
      ]
    }).compileComponents();
  });

  it('creates the component', () => {
    const fixture = TestBed.createComponent(NewIdeaPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
