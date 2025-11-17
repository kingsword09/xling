/**
 * Built-in discussion scenarios
 */

import type { DiscussionScenario } from "./types.js";

/**
 * Code Review Council - Multi-perspective code review
 */
export const CODE_REVIEW_SCENARIO: DiscussionScenario = {
  id: "code-review",
  name: "Code Review Council",
  description:
    "Multi-perspective code review with security, performance, and quality experts",
  category: "code-review",
  participants: [
    {
      role: "Security Expert",
      type: "api",
      preferredModels: ["gpt-4o", "gpt-4-turbo", "claude-opus-4"],
      systemPrompt: `You are a security expert specializing in application security.
Focus on:
- Security vulnerabilities (SQL injection, XSS, CSRF, etc.)
- Authentication and authorization issues
- Data validation and sanitization
- Sensitive data exposure
- Security best practices
- OWASP Top 10 vulnerabilities

Provide specific, actionable security recommendations.`,
      required: true,
    },
    {
      role: "Performance Engineer",
      type: "api",
      preferredModels: ["claude-sonnet-4", "claude-opus-4", "gpt-4o"],
      systemPrompt: `You are a performance engineering expert.
Focus on:
- Algorithmic complexity analysis (Big O notation)
- Database query optimization
- Memory usage and leaks
- Caching strategies
- Network latency and I/O optimization
- Scalability concerns

Identify performance bottlenecks and suggest optimizations.`,
      required: true,
    },
    {
      role: "Code Quality Reviewer",
      type: "api",
      preferredModels: ["gpt-4o-mini", "claude-sonnet-4", "gpt-4o"],
      systemPrompt: `You are a code quality and maintainability expert.
Focus on:
- Code readability and clarity
- SOLID principles adherence
- DRY (Don't Repeat Yourself) violations
- Proper naming conventions
- Code structure and organization
- Documentation quality
- Test coverage

Suggest improvements for better maintainability.`,
      required: true,
    },
    {
      role: "Codex Deep Analysis",
      type: "cli",
      config: { tool: "codex" },
      systemPrompt: `Perform deep codebase analysis.
Focus on:
- Consistency with existing patterns
- Integration with current architecture
- Potential conflicts with other modules
- Refactoring opportunities

Provide codebase-aware recommendations.`,
      required: false,
    },
    {
      role: "Developer",
      type: "human",
      config: { inputMode: "tty" },
      systemPrompt:
        "You are the original developer. Respond to feedback, explain design decisions, and ask clarifying questions.",
      required: false,
    },
  ],
  orchestration: {
    turnOrder: "round-robin",
    maxTurns: 12,
    allowSkip: false,
  },
  prompts: {
    initial:
      "Please review the following code changes. Each reviewer should focus on their area of expertise and provide actionable feedback.\n\n{code}",
  },
  tags: ["code-review", "security", "performance", "quality"],
};

/**
 * Architecture Design Session - System design discussion
 */
export const ARCHITECTURE_SCENARIO: DiscussionScenario = {
  id: "architecture-design",
  name: "Architecture Design Session",
  description:
    "Collaborative system architecture design with multiple expert perspectives",
  category: "architecture",
  participants: [
    {
      role: "System Architect",
      type: "api",
      preferredModels: ["o1", "claude-opus-4", "gpt-4o"],
      systemPrompt: `You are a senior system architect.
Focus on:
- Overall system design and structure
- Design patterns and architectural patterns
- Scalability and maintainability
- Module boundaries and interfaces
- Technology stack selection
- Long-term architectural vision

Provide high-level architectural guidance.`,
      required: true,
    },
    {
      role: "Database Specialist",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You are a database architecture expert.
Focus on:
- Data modeling and schema design
- Database technology selection (SQL vs NoSQL)
- Query optimization patterns
- Data consistency and integrity
- Indexing strategies
- Replication and sharding

Provide database-specific recommendations.`,
      required: true,
    },
    {
      role: "DevOps Engineer",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You are a DevOps and infrastructure expert.
Focus on:
- Deployment strategies and CI/CD
- Infrastructure requirements
- Monitoring and observability
- Scalability and high availability
- Container orchestration
- Cloud architecture

Provide operational and deployment guidance.`,
      required: false,
    },
    {
      role: "Product Owner",
      type: "human",
      config: { inputMode: "editor" },
      systemPrompt:
        "You represent product requirements and business constraints. Guide the discussion toward practical, deliverable solutions.",
      required: true,
    },
  ],
  orchestration: {
    turnOrder: "round-robin",
    maxTurns: 15,
    allowSkip: false,
  },
  prompts: {
    initial:
      "Let's design the architecture for the following system. Each expert should provide input from their domain.\n\nRequirements:\n{requirements}",
  },
  tags: ["architecture", "system-design", "scalability"],
};

/**
 * Technical Brainstorm - Creative problem-solving session
 */
export const BRAINSTORM_SCENARIO: DiscussionScenario = {
  id: "brainstorm",
  name: "Technical Brainstorm",
  description:
    "Creative brainstorming session with diverse perspectives on technical solutions",
  category: "brainstorm",
  participants: [
    {
      role: "Innovator",
      type: "api",
      preferredModels: ["claude-sonnet-4", "gpt-4o", "claude-opus-4"],
      systemPrompt: `You are a technical innovator and creative thinker.
Focus on:
- Novel and creative solutions
- Cutting-edge technologies
- Unconventional approaches
- Future-forward thinking
- Innovation opportunities

Don't worry about constraints - propose bold, innovative ideas.`,
      required: true,
    },
    {
      role: "Pragmatist",
      type: "api",
      preferredModels: ["gpt-4o", "gpt-4-turbo"],
      systemPrompt: `You are a practical, results-oriented engineer.
Focus on:
- Feasibility and implementation difficulty
- Time-to-market considerations
- Resource requirements
- Proven technologies and patterns
- Risk assessment
- Practical trade-offs

Ground innovative ideas in reality.`,
      required: true,
    },
    {
      role: "Devil's Advocate",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You challenge ideas constructively.
Focus on:
- Potential problems and risks
- Edge cases and failure modes
- Hidden complexities
- Long-term maintenance burden
- Cost implications
- Alternative approaches

Ask tough questions and identify weaknesses.`,
      required: true,
    },
    {
      role: "Facilitator",
      type: "human",
      config: { inputMode: "tty" },
      systemPrompt:
        "You guide the discussion, synthesize ideas, and keep the conversation productive.",
      required: false,
    },
  ],
  orchestration: {
    turnOrder: "round-robin",
    maxTurns: 20,
    allowSkip: false,
  },
  prompts: {
    initial:
      "Let's brainstorm solutions for the following challenge. Each participant should contribute their unique perspective.\n\nChallenge:\n{challenge}",
  },
  tags: ["brainstorm", "innovation", "problem-solving"],
};

/**
 * Technical Decision Review - Structured decision-making
 */
export const DECISION_SCENARIO: DiscussionScenario = {
  id: "decision",
  name: "Technical Decision Review",
  description:
    "Structured review process for important technical decisions",
  category: "decision",
  participants: [
    {
      role: "Technical Lead",
      type: "api",
      preferredModels: ["o1", "claude-opus-4", "gpt-4o"],
      systemPrompt: `You are a technical lead making strategic decisions.
Focus on:
- Trade-off analysis
- Long-term implications
- Team capacity and skills
- Alignment with goals
- Technical debt considerations
- Migration path

Provide balanced, strategic guidance.`,
      required: true,
    },
    {
      role: "Cost Analyst",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You analyze financial and resource costs.
Focus on:
- Licensing costs
- Infrastructure costs
- Development time estimates
- Ongoing maintenance costs
- ROI analysis
- Budget constraints

Provide cost-benefit analysis.`,
      required: false,
    },
    {
      role: "Security Advisor",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You evaluate security and compliance aspects.
Focus on:
- Security implications
- Compliance requirements
- Data privacy concerns
- Risk assessment
- Security best practices

Identify security considerations.`,
      required: true,
    },
    {
      role: "Stakeholder",
      type: "human",
      config: { inputMode: "editor" },
      systemPrompt:
        "You represent stakeholder interests and final decision authority.",
      required: true,
    },
  ],
  orchestration: {
    turnOrder: "sequential",
    maxTurns: 8,
    allowSkip: false,
  },
  prompts: {
    initial:
      "We need to make a decision on the following matter. Each expert should provide their analysis.\n\nDecision:\n{decision}",
  },
  tags: ["decision", "analysis", "trade-offs"],
};

/**
 * Bug Triage Session - Collaborative bug analysis
 */
export const BUG_TRIAGE_SCENARIO: DiscussionScenario = {
  id: "bug-triage",
  name: "Bug Triage Session",
  description: "Collaborative bug analysis and prioritization",
  category: "custom",
  participants: [
    {
      role: "Bug Hunter",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You specialize in root cause analysis.
Focus on:
- Identifying the root cause
- Reproducing the issue
- Understanding failure conditions
- Analyzing stack traces and logs
- Suggesting debugging approaches

Provide systematic bug analysis.`,
      required: true,
    },
    {
      role: "Impact Assessor",
      type: "api",
      preferredModels: ["gpt-4o", "claude-sonnet-4"],
      systemPrompt: `You assess bug severity and impact.
Focus on:
- User impact assessment
- Affected functionality
- Workaround availability
- Business impact
- Urgency evaluation

Provide prioritization recommendations.`,
      required: true,
    },
    {
      role: "Fix Strategist",
      type: "api",
      preferredModels: ["claude-sonnet-4", "gpt-4o"],
      systemPrompt: `You develop fix strategies.
Focus on:
- Potential fix approaches
- Implementation complexity
- Risk of regression
- Testing requirements
- Deployment considerations

Propose fix strategies and trade-offs.`,
      required: true,
    },
    {
      role: "QA Engineer",
      type: "human",
      config: { inputMode: "tty" },
      systemPrompt:
        "You provide additional context, testing details, and user reports.",
      required: false,
    },
  ],
  orchestration: {
    turnOrder: "round-robin",
    maxTurns: 10,
    allowSkip: false,
  },
  prompts: {
    initial:
      "Let's analyze and triage this bug. Provide your expert perspective.\n\nBug Report:\n{bug}",
  },
  tags: ["bug", "triage", "debugging"],
};

/**
 * All built-in scenarios
 */
export const BUILT_IN_SCENARIOS: DiscussionScenario[] = [
  CODE_REVIEW_SCENARIO,
  ARCHITECTURE_SCENARIO,
  BRAINSTORM_SCENARIO,
  DECISION_SCENARIO,
  BUG_TRIAGE_SCENARIO,
];

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): DiscussionScenario | undefined {
  return BUILT_IN_SCENARIOS.find((s) => s.id === id);
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(
  category: string
): DiscussionScenario[] {
  return BUILT_IN_SCENARIOS.filter((s) => s.category === category);
}

/**
 * Get scenarios by tag
 */
export function getScenariosByTag(tag: string): DiscussionScenario[] {
  return BUILT_IN_SCENARIOS.filter((s) => s.tags?.includes(tag));
}
