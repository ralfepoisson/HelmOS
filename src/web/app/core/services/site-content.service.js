(function () {
  'use strict';

  angular
    .module('helmosApp.core')
    .service('SiteContentService', SiteContentService);

  function SiteContentService() {
    this.getLandingPageContent = function () {
      return {
        navigation: [
          { label: 'Platform', href: '#platform' },
          { label: 'How It Works', href: '#workflow' },
          { label: 'Agents', href: '#agents' },
          { label: 'Governance', href: '#governance' },
          { label: 'Docs', href: '#launch' }
        ],
        hero: {
          eyebrow: 'Founder control plane',
          title: ['Steer', 'Autonomous', 'Companies'],
          description: 'HelmOS is the operating system for AI-native founders. Design your company architecture, deploy specialized agents, and run the organization from a single command centre.',
          primaryCta: {
            label: 'Start Your Company',
            href: '#launch'
          },
          secondaryCta: {
            label: 'Watch Demo',
            href: '#workflow'
          },
          highlights: [
            'Founder-first startup methodology',
            'Autonomous build-test-improve agent loops',
            'Governed execution with traceable decisions'
          ],
          signalCards: [
            {
              label: 'Active agents',
              value: '12',
              detail: 'research, product, engineering, operations'
            },
            {
              label: 'Governance state',
              value: 'Audit-ready',
              detail: 'budgets, approvals, execution logs'
            }
          ]
        },
        pillars: [
          {
            icon: '◎',
            title: 'Company Design',
            description: 'Define the operating system of your company before writing a single line of code.',
            bullets: ['Mission and operating model', 'Agent roles and decision rights', 'Execution-ready knowledge base']
          },
          {
            icon: '◌',
            title: 'Agent Deployment',
            description: 'Launch autonomous AI teams for product, engineering, research, marketing, and operations.',
            bullets: ['Requirements to backlog translation', 'Autonomous implementation loops', 'Continuous testing and improvement']
          },
          {
            icon: '⬡',
            title: 'Governance Layer',
            description: 'Monitor, audit, and steer agent behaviour with guardrails built for real company operations.',
            bullets: ['Approval policies and budgets', 'Transparent decisions and logs', 'Escalation when risk increases']
          }
        ],
        logos: [
          'AgentLabs',
          'Autonomy Ventures',
          'NeuralForge',
          'Vector Foundry'
        ],
        workflow: [
          {
            step: '01',
            title: 'Shape the company system',
            description: 'Turn an idea into a defined mission, target customer, operating model, and execution map.'
          },
          {
            step: '02',
            title: 'Generate product and technical plans',
            description: 'Translate strategy into product specs, architecture, backlog, and implementation guidance.'
          },
          {
            step: '03',
            title: 'Deploy autonomous agent teams',
            description: 'Let coding, planning, and testing agents ship features in tight improvement loops.'
          },
          {
            step: '04',
            title: 'Govern, review, and evolve',
            description: 'Keep everything traceable with approvals, audits, and continuous founder oversight.'
          }
        ],
        governance: {
          title: 'Governance without bottlenecks',
          description: 'HelmOS keeps autonomous execution fast without giving up control. Policies, escalation rules, and logs stay visible to founders as the company scales.',
          checks: [
            'Clear agent scopes and decision boundaries',
            'Escalation paths for security and architecture changes',
            'Persistent memory of artefacts, outputs, and decisions',
            'Reviewable execution loops grounded in tests'
          ]
        },
        launch: {
          title: 'Launch a startup in hours, not months.',
          description: 'Build the company blueprint, spin up your first agents, and keep momentum with a control plane made for AI-native execution.',
          cta: {
            label: 'Book a Founder Session',
            href: 'mailto:founders@helmos.ai'
          }
        }
      };
    };
  }
})();
