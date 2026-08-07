---
type: blog
title: LG AI Youth Camp
slug: lg-ai-youth-camp
description: I spent about 6 months as a first-generation participant in the LG AI Youth Camp, a program run by LG Discovery Lab and Seoul National University.
date: '2024-05-14'
series: 'LG AI Youth Camp'
coverimage: ''
published: true
aiTranslated: true
---

I had just transferred to Mongmun Middle School in November and was busy catching up on all the assignments I'd missed, when I spotted a poster while waiting in the lunch line.

![An interesting discovery](/images/uploads/SCR-20240731-kqxz.jpeg)

The moment I saw it, I thought **"this camp was made for me"** and took a photo. But then the second-guessing started. I was already running a pretty packed academy schedule, and I'd been burned before — back in fourth grade, I impulsively entered a Samsung competition and just wasted time on it. I kept going back and forth for a few days.

The thing that kept pulling me back? A **free trip to the US**. I'd been to Silicon Valley a few years earlier, but back then I was just starting to get interested in tech and didn't really take it in properly. Then COVID hit, and I spent a lot of time reading about the industry online — which only made me want to go back even more.

I eventually decided to just go for it. Worst case, nothing happens.

## What is the LG AI Youth Camp?

I went home and looked it up properly.

> The LG AI Youth Camp is a youth AI curriculum created by LG Discovery Lab and Seoul National University.

> Join a 1-night, 2-day camp at SNU, explore ways to solve real-world problems using AI, complete a 10-week online team project, and compete for a chance to attend a free summer camp in Silicon Valley.

To put it plainly: it's essentially a competition run by [LG Discovery Lab](https://www.lgdlab.or.kr/) (LG's AI education arm) and Seoul National University, where you build an AI-powered project over several months.

The process went roughly like this:

- Submit an idea video in the first round of online applications — top 100 selected
- February: SNU camp for team formation and planning
- May: Final presentation, where 12 participants are selected for the US trip

_I also thought this might be a good chance to break my habit of obsessively learning new tech without ever actually building anything with it._

## First Round Application

I usually spend a long time nailing down an idea before I write anything, and here that almost got me. I barely made it.

After a lot of deliberation (probably until around 10 PM after school), I landed on the idea of `a device that uses computer vision to read text from books, then uses an LLM to provide background knowledge or translations on demand`.

The deadline was midnight. I finished filming around 11:40 and was feeling pretty good about having some time to spare — then I noticed there were two 500-character fields and one 1000-character field I hadn't even seen. I typed like crazy and submitted with about 30 seconds left. (Pretty sure I was the last one.)

In December, I was on my way home from the academy when my mom called to say I got in. I can't say I was completely shocked — when I have a feeling something will work out, it usually does. My main thought was just relief, given that I'd recently been rejected from the SNU gifted program.

## SNU Camp

![LG AI Youth Camp](/images/uploads/SCR-20240820-dos.png)

In February, we spent one night and two days at Seoul National University — meeting our teammates, brainstorming ideas, and sitting through lectures by SNU professors. The lectures were basically the quality of an actual university orientation class, which was great for getting my thoughts on AI organized. (Most people slept through them.) Each team also got a SNU undergrad or grad student as a mentor, which was genuinely useful — both for the project and for asking questions I'd always been curious about.

During the day, the food was good and it was fun to walk around campus.

![Things were good up to this point](/images/uploads/SCR-20240820-sod.png)

Then we got to the dorm and the ~~nightmare~~ suffering began. We had to come up with a solid idea by the next morning, and nothing was coming to me. It felt like a replay of the application process — I was up until around 3 AM in the room with my older teammates, constantly revising the proposal. We eventually landed on an idea I'd had as a backup during the application: `a program that describes product images on online shopping platforms`. We finished the write-up and went to sleep.

The next day, a professor gave us feedback and pointed out that **we needed to narrow the scope significantly**. At that point, we kept the image recognition concept but pivoted toward helping students study science textbooks — basic explanations plus interpreting figures and diagrams.

That was enough for now. We went home.

---

https://www.youtube.com/watch?v=FpIRgBNSDcs

## 10-Week Project

The project ran over 10 weeks via weekly Zoom sessions, with three interim presentations to get feedback and iterate.

### Roles

LG put teams together based on information from our applications, supposedly balancing skill sets. Our team ended up being two people who had applied as a pair, plus two individual applicants (including me). Since I was the only one on the team who could actually write code, I naturally became the developer. The other three took on roles as team lead, designer, and a sort of assistant developer / general helper.

### Narrowing the Idea

The direction of the project shifted a lot during the planning phase, with many variations of the original concept floating around.

- Visually impaired people have a hard time getting information from product images when buying **clothing** online.
- Navigating a disorganized grocery store is difficult.
- Books are hard to read for visually impaired people.
- A program that describes personal photos for visually impaired users.

Each team member proposed an idea, then we each researched the AI models and datasets that could support it and presented our findings.

We ended up going with the original shopping concept, but narrowed to **clothing**.

### AI Models and Data

Given our skills and the time we had, training our own model or building a dataset from scratch was completely out of the question, so we did a lot of research. For about two weeks I went through [Korea's Public Data Portal](https://data.go.kr), [Kaggle](https://kaggle.com), [Hugging Face](https://huggingface.co), and GitHub pretty thoroughly.

This is where I learned that **actually shipping something is hard**. Things that look simple when you're running practice code or tutorials — getting data, training a model — turn into a mess quickly. Datasets were too large (+400GB), library installations broke things, and so on.

Even clothing turned out to be too ambitious, so we narrowed it down further to **shoes**.

Then I trained YOLOv8 on my MacBook Pro. Setting it to use MPS (Apple Silicon's GPU acceleration) made it faster than I expected, but it was also the first time I've heard my computer sound like a plane taking off.

### Prototype

I trained the YOLO model to return only the type of shoe (dress shoe, sneaker, etc.) and whether it had laces — as a JSON output.

The app was meant for visually impaired users, which meant it should ideally work with VoiceOver or similar accessibility tech. For the prototype though, we went with triggering it through the right-click context menu on an image. We also kept the stack as simple as possible — I'd learned from watching our idea shift rapidly that **the simpler the implementation, the better**. For the second interim presentation, the backend was FastAPI and the frontend was a single HTML file served from the same server. The backend just received the image and passed it to the model. ~~Pretty bare-bones in retrospect.~~

After that I piped the output to OpenAI's GPT-4 Turbo to generate a more detailed description of what the shoe looked like.

## Graduation — Final Presentation

After a late night putting the finishing touches on everything, May 13th arrived: final presentation day.

![Entrance](/images/uploads/14F76946-2F6B-40C2-8F3C-1670E887A2C5_1_105_c.jpeg)

The ceremony was originally scheduled for the SNU building where we'd held the camp, but it moved to the LG Electronics R&D campus in Magok for some reason. ~~(Works for me.)~~

Riding the escalator up, we passed some interesting floors.

![Secure zone vibes](/images/uploads/1E333D95-D305-437B-9593-E243A0B404A2_1_105_c.jpeg)

Got snacks.

![We're in](/images/uploads/B6487BFC-5D25-4875-A47A-82045EEF918F_1_105_c.jpeg)

The venue was a large conference hall — bigger than I expected.

We arrived first and started "preparing" (which really meant last-minute additions). The other team members trickled in after.

After about an hour of prep, presentations began. With so many teams, it wasn't one-by-one on stage — instead, there were three time slots where each team had a small booth, and judges, teachers, and other teams circulated to see everyone.

The scale caught me off guard, and actual LG employees were walking around too. Our mentor had to leave for a medical appointment, so we were on our own. I handled the technical section solo; the other three covered the intro, purpose, and everything else.

I'd assumed "just present and it'll be fine," but seeing how thoroughly prepared other teams were, I started to feel like we'd underprepared. I tried to compensate by explaining the development process and implementation in as much detail as I could. People asked a lot of questions and seemed to respond well — probably because I'd talked through the project internally so many times that I could explain it clearly. One LG employee asked if I'd built everything myself, and when I said yes, he gave me a compliment. Whether he meant it or not, I appreciated it.

After lunch, scores were tallied and the top 6 teams were called up for a stage presentation. I wasn't expecting much — and then our team's name was called. I went up genuinely happy.

The other teams had printed materials for the judges and clearly put in a lot of work, which surprised me again. I just did my best. We hadn't set up a proper evaluation method during the project, so when a judge asked about it, my answer wasn't great.

![Me talking](/images/uploads/20240511_LG_AI행사-463.jpg)

We moved to the awards room with some nerves.

![The windows in the back were originally covered](/images/uploads/E08066D9-2123-4881-B0C5-A769B1072318_1_105_c.jpeg)

Everyone got a LAMY pen. Then the two lower-tier awards were announced — we won both, but honestly the third award (the US trip) was the only one I really cared about, so I just stayed tense.

The final award. Best case was winning as a team. Two other teams were called up. Then it went to individual selections.

My name was called. I walked up to the stage genuinely thrilled.

![Going to America](/images/uploads/C13C2332-0685-4D54-A17B-92B63D415233_1_105_c.jpeg)

That was the end of a three-month journey.

---

https://www.youtube.com/watch?v=8cuL98yA3og

## Thoughts

Most competitions in the CS space are algorithm-focused, but I've always been more interested in actually building products. I'd never done well in those. Finding a competition that simulates the actual process of building something — like a startup — was genuinely refreshing. The fact that a major company backed it with real resources made the whole process feel polished and well-run.

The program is supposed to continue going forward, and I'd say it's worth applying even if you don't win. There's a lot you can only learn by actually running a project. If you're on the fence, just go for it.
