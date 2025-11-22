# Where2Meet Documentation Hub

Welcome to the Where2Meet documentation. This folder contains all technical documentation, architectural guidelines, and development workflows.

## 📁 Documentation Structure

```
META/
├── architecture/          # Technical architecture & design
│   ├── API_SPEC.md       # API routes specification
│   ├── COMPONENT_GUIDE.md # Component usage & patterns
│   ├── STATE_MANAGEMENT.md # Zustand & React Query patterns
│   ├── LAYOUT.md         # Layout specs for each user journey stage
│   └── UIUX_GUIDE.md     # Design system & UI/UX standards
├── workflow/             # Development processes
│   ├── IMPLEMENTATION_WORKFLOW.md # Feature development workflow
│   ├── TESTING_STRATEGY.md       # Testing approach & tools
│   └── TROUBLESHOOTING.md        # Common issues & solutions
├── CLIENT_ARCHITECTURE.md # High-level client architecture
├── PRODUCT.md            # Product requirements & vision
└── plan.md              # Development plan & agent setup
```

---

## 🚀 Quick Start Guides

### For New Developers

1. **Start here**: Read [CLIENT_ARCHITECTURE.md](./CLIENT_ARCHITECTURE.md) for the big picture
2. **Understand the product**: Read [PRODUCT.md](./PRODUCT.md)
3. **Learn the workflow**: Read [workflow/IMPLEMENTATION_WORKFLOW.md](./workflow/IMPLEMENTATION_WORKFLOW.md)
4. **Set up your environment**: Follow the setup instructions in the main README.md

### For Implementing a Feature

1. Review [plan.md](./plan.md) to understand the agent-assisted development workflow
2. Create a feature spec in `docs/features/`
3. Follow [workflow/IMPLEMENTATION_WORKFLOW.md](./workflow/IMPLEMENTATION_WORKFLOW.md)
4. Refer to:
   - [architecture/COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md) for component patterns
   - [architecture/STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md) for state patterns
   - [architecture/UIUX_GUIDE.md](./architecture/UIUX_GUIDE.md) for design standards
   - [architecture/API_SPEC.md](./architecture/API_SPEC.md) for API details

### For Writing Tests

1. Read [workflow/TESTING_STRATEGY.md](./workflow/TESTING_STRATEGY.md)
2. Check existing tests in `__tests__/` for patterns
3. Run `npm run test:coverage` to verify coverage

### When Stuck

1. Check [workflow/TROUBLESHOOTING.md](./workflow/TROUBLESHOOTING.md) for common issues
2. Search this documentation for keywords
3. Create a GitHub issue with details

---

## 📚 Documentation Index

### Architecture Documentation

| Document | Purpose | When to Read |
|----------|---------|-------------|
| [CLIENT_ARCHITECTURE.md](./CLIENT_ARCHITECTURE.md) | High-level system design | Starting project, making architectural changes |
| [API_SPEC.md](./architecture/API_SPEC.md) | API routes & contracts | Working with APIs, debugging API issues |
| [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md) | Component usage & props | Creating/using components |
| [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md) | Zustand & React Query patterns | Managing state, data fetching |
| [LAYOUT.md](./architecture/LAYOUT.md) | Layout specifications for each stage | Implementing UI, understanding user journey |
| [UIUX_GUIDE.md](./architecture/UIUX_GUIDE.md) | Design system & accessibility | Building UI, styling components |

### Workflow Documentation

| Document | Purpose | When to Read |
|----------|---------|-------------|
| [IMPLEMENTATION_WORKFLOW.md](./workflow/IMPLEMENTATION_WORKFLOW.md) | Complete development workflow | Implementing any feature |
| [TESTING_STRATEGY.md](./workflow/TESTING_STRATEGY.md) | Testing approach & tools | Writing tests, debugging test failures |
| [TROUBLESHOOTING.md](./workflow/TROUBLESHOOTING.md) | Common issues & solutions | Encountering errors or unexpected behavior |

### Planning & Product

| Document | Purpose | When to Read |
|----------|---------|-------------|
| [PRODUCT.md](./PRODUCT.md) | Product vision & requirements | Understanding the "why" behind features |
| [plan.md](./plan.md) | Development plan & agent setup | Setting up development workflow, understanding the overall strategy |

---

## 🤖 AI Agent Setup

Where2Meet uses AI agents to assist with development:

- **Implementation Agent**: Writes feature code based on specs
- **Code Review Agent**: Reviews code for quality and consistency
- **UI/UX Agent**: Ensures design system compliance and accessibility
- **Testing Agent**: Generates comprehensive test coverage
- **Documentation Agent**: Keeps documentation in sync

See [plan.md](./plan.md) for detailed agent configuration and workflow.

---

## 🔧 Common Tasks

### Adding a New Component

1. Define types in `types/index.ts`
2. Create component in appropriate folder:
   - UI components: `components/ui/`
   - Map components: `components/map/`
   - Sidebar components: `components/sidebar/`
3. Follow patterns in [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md)
4. Add to component index
5. Write tests
6. Update [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md)

### Adding State

1. Update `store/useMeetingStore.ts`
2. Define TypeScript interfaces
3. Add actions following naming conventions
4. Write tests for new actions
5. Update [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md)

### Adding an API Route

1. Create route in `app/api/`
2. Follow patterns in [API_SPEC.md](./architecture/API_SPEC.md)
3. Add error handling
4. Write tests
5. Document in [API_SPEC.md](./architecture/API_SPEC.md)

### Updating Styles

1. Follow [UIUX_GUIDE.md](./architecture/UIUX_GUIDE.md) design system
2. Use Tailwind classes only
3. Ensure accessibility (WCAG 2.1 AA)
4. Test responsive design
5. Run UI/UX Agent for review

---

## 📝 Documentation Standards

### When to Update Documentation

- **Always**: When changing public APIs, components, or workflows
- **Immediately**: When discovering bugs or gotchas (add to TROUBLESHOOTING.md)
- **Before PR**: Ensure all relevant docs are updated

### Documentation Principles

1. **Accuracy**: Keep docs in sync with code
2. **Examples**: Include code examples for all patterns
3. **Clarity**: Write for someone new to the project
4. **Searchability**: Use clear headings and keywords
5. **Maintenance**: Treat docs as code (review, test, version)

### How to Update Docs

1. Make changes in the relevant `.md` file
2. Ensure examples are tested and work
3. Add to the "What Changed" section in your PR
4. Request documentation review

---

## 🎯 Architecture Decisions

Key architectural decisions are documented in:

- [CLIENT_ARCHITECTURE.md](./CLIENT_ARCHITECTURE.md) - Overall structure
- Feature specs in `docs/features/` - Feature-specific decisions

When making significant architectural changes:
1. Create an Architecture Decision Record (ADR) in `docs/decisions/`
2. Update [CLIENT_ARCHITECTURE.md](./CLIENT_ARCHITECTURE.md)
3. Discuss with team before implementing

---

## 🔍 Finding What You Need

### By Topic

- **APIs**: [API_SPEC.md](./architecture/API_SPEC.md)
- **Components**: [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md)
- **State**: [STATE_MANAGEMENT.md](./architecture/STATE_MANAGEMENT.md)
- **Layouts**: [LAYOUT.md](./architecture/LAYOUT.md)
- **Styling**: [UIUX_GUIDE.md](./architecture/UIUX_GUIDE.md)
- **Testing**: [TESTING_STRATEGY.md](./workflow/TESTING_STRATEGY.md)
- **Workflow**: [IMPLEMENTATION_WORKFLOW.md](./workflow/IMPLEMENTATION_WORKFLOW.md)
- **Errors**: [TROUBLESHOOTING.md](./workflow/TROUBLESHOOTING.md)

### By Task

- **Starting a new feature**: [IMPLEMENTATION_WORKFLOW.md](./workflow/IMPLEMENTATION_WORKFLOW.md)
- **Fixing a bug**: [TROUBLESHOOTING.md](./workflow/TROUBLESHOOTING.md)
- **Adding a component**: [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md)
- **Working with maps**: [API_SPEC.md](./architecture/API_SPEC.md) + [COMPONENT_GUIDE.md](./architecture/COMPONENT_GUIDE.md)
- **Styling a component**: [UIUX_GUIDE.md](./architecture/UIUX_GUIDE.md)
- **Writing tests**: [TESTING_STRATEGY.md](./workflow/TESTING_STRATEGY.md)

### Search Tips

Use your editor's global search (Cmd/Ctrl + Shift + F) to search across all documentation:
- Search for error messages in TROUBLESHOOTING.md
- Search for component names in COMPONENT_GUIDE.md
- Search for API endpoints in API_SPEC.md

---

## 📖 External Resources

### Next.js 15
- [Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)

### Google Maps
- [Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Places API](https://developers.google.com/maps/documentation/places/web-service)
- [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/)

### State Management
- [Zustand](https://docs.pmnd.rs/zustand)
- [TanStack Query (React Query)](https://tanstack.com/query/latest)

### Testing
- [Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)

### UI/UX
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 🤝 Contributing to Documentation

Found something unclear or outdated?

1. **Small fixes**: Just update the file and commit
2. **Major changes**: Create an issue first to discuss
3. **New sections**: Follow the existing structure and style
4. **Examples**: Always test code examples before adding

All documentation follows [Markdown syntax](https://www.markdownguide.org/basic-syntax/).

---

## 📅 Document Version History

This documentation set was created for Where2Meet v1.0.

**Last Updated**: 2024-01-19
**Next Review**: When architectural changes are made

---

## ✅ Documentation Checklist

Before closing a PR that modifies functionality:

- [ ] Updated relevant architecture docs
- [ ] Added/updated component examples
- [ ] Documented new APIs or endpoints
- [ ] Updated troubleshooting if new issues discovered
- [ ] Ran spell check on markdown files
- [ ] Verified all code examples work
- [ ] Updated "Last Updated" date in this README

---

Need help? Check [TROUBLESHOOTING.md](./workflow/TROUBLESHOOTING.md) or create a GitHub issue!
