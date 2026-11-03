# Full Project Workflow: E-Commerce Order Management System

> **Complete end-to-end example** demonstrating the Multi-Stage Orchestration Workflow from feature request to production release.

---

## Table of Contents

1. [Feature Request](#feature-request)
2. [Stage 1: Architecture Decomposition](#stage-1-architecture-decomposition)
3. [Stage 2: Story Mapping](#stage-2-story-mapping)
4. [Stage 3: Prioritization](#stage-3-prioritization)
5. [Stage 4: Enhanced Task Breakdown](#stage-4-enhanced-task-breakdown)
6. [Stage 5: Contract Definition](#stage-5-contract-definition)
7. [Stage 6: Parallel Execution](#stage-6-parallel-execution)
8. [Stage 7: Integration & Validation](#stage-7-integration--validation)
9. [Stage 8: Release & Learning](#stage-8-release--learning)
10. [Summary](#summary)

---

## Feature Request

**Feature Name**: E-Commerce Order Management System

**Business Objective**: Enable customers to place orders, track order status, and manage their order history while integrating with inventory and payment systems.

**Requirements**:
- Users can create, modify, and cancel orders
- Orders contain line items with products and quantities
- Payment processing integration required
- Inventory must be reserved when order is placed
- Order status tracking (pending, confirmed, shipped, delivered, cancelled)
- Email notifications on status changes
- Admin dashboard for order management

**Success Criteria**:
- 95% order success rate
- < 2 second order placement time
- Real-time inventory updates
- Automated email notifications

---

## Stage 1: Architecture Decomposition

**Agent**: OpenCoder (orchestrator) + ContextScout

**CLI Command**:
```bash
# OpenCoder delegates to ArchitectureAnalyzer
task(
  subagent_type="ArchitectureAnalyzer",
  description="Analyze architecture for Order Management System",
  prompt="Analyze domain structure for Order Management System.
          Requirements: [see above]
          Identify bounded contexts, aggregates, and relationships."
)
```

### ArchitectureAnalyzer Output

**File**: `.tmp/tasks/order-management-system/contexts.json`

```json
{
  "feature": "order-management-system",
  "analyzed_at": "2026-02-14T10:00:00Z",
  "bounded_contexts": [
    {
      "name": "order-management",
      "type": "core",
      "description": "Manages order lifecycle from creation to fulfillment",
      "module": "@app/orders",
      "aggregates": [
        {
          "name": "Order",
          "root": "Order",
          "entities": ["Order", "LineItem"],
          "value_objects": ["OrderStatus", "Money", "Address"],
          "invariants": [
            "Order must have at least one line item",
            "Order total must match sum of line items",
            "Cannot modify order after it's shipped",
            "Quantity must be positive"
          ]
        }
      ],
      "domain_events": [
        {
          "name": "OrderPlaced",
          "description": "Order successfully created",
          "payload": ["orderId", "customerId", "items", "total", "timestamp"]
        },
        {
          "name": "OrderModified",
          "description": "Order details updated",
          "payload": ["orderId", "changes", "timestamp"]
        },
        {
          "name": "OrderCancelled",
          "description": "Order cancelled by user or system",
          "payload": ["orderId", "reason", "timestamp"]
        },
        {
          "name": "OrderShipped",
          "description": "Order shipped to customer",
          "payload": ["orderId", "trackingNumber", "timestamp"]
        },
        {
          "name": "OrderDelivered",
          "description": "Order delivered to customer",
          "payload": ["orderId", "timestamp"]
        }
      ],
      "capabilities": [
        "Create order",
        "Modify order",
        "Cancel order",
        "Track order status",
        "View order history"
      ]
    },
    {
      "name": "inventory",
      "type": "supporting",
      "description": "Manages product inventory and stock reservations",
      "module": "@app/inventory",
      "aggregates": [
        {
          "name": "Product",
          "root": "Product",
          "entities": ["Product", "StockLevel"],
          "value_objects": ["SKU", "Quantity"],
          "invariants": [
            "Stock level cannot be negative",
            "Reserved quantity cannot exceed available stock"
          ]
        }
      ],
      "domain_events": [
        {
          "name": "StockReserved",
          "description": "Stock reserved for order",
          "payload": ["productId", "quantity", "orderId", "timestamp"]
        },
        {
          "name": "StockReleased",
          "description": "Reserved stock released back to inventory",
          "payload": ["productId", "quantity", "orderId", "timestamp"]
        },
        {
          "name": "StockReplenished",
          "description": "New stock added to inventory",
          "payload": ["productId", "quantity", "timestamp"]
        }
      ],
      "capabilities": [
        "Reserve stock",
        "Release stock",
        "Check availability",
        "Update stock levels"
      ]
    },
    {
      "name": "payment",
      "type": "supporting",
      "description": "Handles payment processing and refunds",
      "module": "@app/payment",
      "aggregates": [
        {
          "name": "Payment",
          "root": "Payment",
          "entities": ["Payment", "PaymentMethod"],
          "value_objects": ["Money", "PaymentStatus"],
          "invariants": [
            "Payment amount must match order total",
            "Cannot refund more than paid amount"
          ]
        }
      ],
      "domain_events": [
        {
          "name": "PaymentProcessed",
          "description": "Payment successfully processed",
          "payload": ["paymentId", "orderId", "amount", "timestamp"]
        },
        {
          "name": "PaymentFailed",
          "description": "Payment processing failed",
          "payload": ["paymentId", "orderId", "reason", "timestamp"]
        },
        {
          "name": "RefundIssued",
          "description": "Refund issued to customer",
          "payload": ["refundId", "paymentId", "amount", "timestamp"]
        }
      ],
      "capabilities": [
        "Process payment",
        "Refund payment",
        "Verify payment status"
      ]
    },
    {
      "name": "notification",
      "type": "generic",
      "description": "Sends email and SMS notifications",
      "module": "@app/notification",
      "aggregates": [
        {
          "name": "Notification",
          "root": "Notification",
          "entities": ["Notification"],
          "value_objects": ["NotificationType", "DeliveryStatus"],
          "invariants": [
            "Notification must have recipient",
            "Template must exist for notification type"
          ]
        }
      ],
      "domain_events": [
        {
          "name": "EmailSent",
          "description": "Email notification sent",
          "payload": ["notificationId", "recipient", "subject", "timestamp"]
        },
        {
          "name": "SMSSent",
          "description": "SMS notification sent",
          "payload": ["notificationId", "recipient", "message", "timestamp"]
        }
      ],
      "capabilities": [
        "Send email",
        "Send SMS",
        "Track delivery status"
      ]
    }
  ],
  "context_relationships": [
    {
      "upstream": "inventory",
      "downstream": "order-management",
      "relationship_type": "customer-supplier",
      "integration_pattern": "events",
      "description": "Order Management subscribes to StockReserved/StockReleased events"
    },
    {
      "upstream": "payment",
      "downstream": "order-management",
      "relationship_type": "customer-supplier",
      "integration_pattern": "api",
      "description": "Order Management calls Payment API to process payments"
    },
    {
      "upstream": "order-management",
      "downstream": "notification",
      "relationship_type": "publisher-subscriber",
      "integration_pattern": "events",
      "description": "Notification subscribes to OrderPlaced, OrderShipped, etc."
    }
  ],
  "ubiquitous_language": {
    "Order": "Customer request to purchase products",
    "LineItem": "Individual product and quantity within an order",
    "OrderStatus": "Current state of order (pending, confirmed, shipped, delivered, cancelled)",
    "StockReservation": "Temporary hold on inventory for pending order",
    "Payment": "Financial transaction for order",
    "Notification": "Communication sent to customer about order status"
  }
}
```

**Module Briefs Created**:
- `.tmp/tasks/order-management-system/module-briefs/order-management.md`
- `.tmp/tasks/order-management-system/module-briefs/inventory.md`
- `.tmp/tasks/order-management-system/module-briefs/payment.md`
- `.tmp/tasks/order-management-system/module-briefs/notification.md`

---

## Stage 2: Story Mapping

**Agent**: OpenCoder (orchestrator) + StoryMapper

**CLI Command**:
```bash
# OpenCoder delegates to StoryMapper
task(
  subagent_type="StoryMapper",
  description="Map user journeys for Order Management",
  prompt="Transform Order Management requirements into user journeys, epics, and stories.
          Use bounded contexts from contexts.json.
          Identify vertical slices for parallel development."
)
```

### StoryMapper Output

**File**: `.tmp/planning/order-management-system/map.json`

```json
{
  "feature": "order-management-system",
  "created_at": "2026-02-14T10:30:00Z",
  "personas": [
    {
      "id": "customer",
      "name": "Customer",
      "role": "End User",
      "goals": ["Purchase products", "Track orders", "Manage order history"],
      "pain_points": ["Complex checkout", "Unclear order status", "Difficult cancellation"],
      "technical_level": "low",
      "primary_use_cases": ["place-order", "track-order", "cancel-order"]
    },
    {
      "id": "admin",
      "name": "Admin",
      "role": "System Administrator",
      "goals": ["Manage orders", "Monitor inventory", "Handle customer issues"],
      "pain_points": ["Manual order processing", "Inventory discrepancies"],
      "technical_level": "high",
      "primary_use_cases": ["order-management", "inventory-management"]
    }
  ],
  "journeys": [
    {
      "id": "place-order",
      "name": "Place Order Journey",
      "persona": "customer",
      "steps": [
        {
          "id": "step-1",
          "action": "Add products to cart",
          "touchpoint": "Product catalog",
          "validation": ["Product exists", "Stock available"]
        },
        {
          "id": "step-2",
          "action": "Review cart and proceed to checkout",
          "touchpoint": "Shopping cart",
          "validation": ["Cart not empty", "Prices current"]
        },
        {
          "id": "step-3",
          "action": "Enter shipping address",
          "touchpoint": "Checkout form",
          "validation": ["Valid address format", "Deliverable location"]
        },
        {
          "id": "step-4",
          "action": "Select payment method and pay",
          "touchpoint": "Payment form",
          "validation": ["Valid payment method", "Sufficient funds"]
        },
        {
          "id": "step-5",
          "action": "Receive order confirmation",
          "touchpoint": "Confirmation page + email",
          "validation": ["Order created", "Email sent"]
        }
      ],
      "success_criteria": [
        "Order created in system",
        "Inventory reserved",
        "Payment processed",
        "Confirmation email sent"
      ],
      "edge_cases": [
        "Out of stock during checkout",
        "Payment failure",
        "Invalid shipping address"
      ]
    },
    {
      "id": "track-order",
      "name": "Track Order Journey",
      "persona": "customer",
      "steps": [
        {
          "id": "step-1",
          "action": "Navigate to order history",
          "touchpoint": "User dashboard",
          "validation": ["User authenticated"]
        },
        {
          "id": "step-2",
          "action": "View order details",
          "touchpoint": "Order detail page",
          "validation": ["Order exists", "User owns order"]
        },
        {
          "id": "step-3",
          "action": "Check order status",
          "touchpoint": "Status timeline",
          "validation": ["Status is current"]
        }
      ],
      "success_criteria": [
        "Order status displayed",
        "Timeline shows progress",
        "Tracking number visible (if shipped)"
      ],
      "edge_cases": ["Order not found", "Status update delay"]
    }
  ],
  "vertical_slices": [
    {
      "id": "order-placement-slice",
      "name": "Order Placement Slice",
      "journeys": ["place-order"],
      "bounded_contexts": ["order-management", "inventory", "payment", "notification"],
      "layers": {
        "frontend": ["Product catalog", "Shopping cart", "Checkout form"],
        "backend": ["Order API", "Inventory API", "Payment API"],
        "database": ["Orders table", "LineItems table", "Inventory table"],
        "external": ["Payment gateway", "Email service"]
      },
      "dependencies": [],
      "estimated_effort": "2 weeks"
    },
    {
      "id": "order-tracking-slice",
      "name": "Order Tracking Slice",
      "journeys": ["track-order"],
      "bounded_contexts": ["order-management"],
      "layers": {
        "frontend": ["Order history page", "Order detail page"],
        "backend": ["Order query API"],
        "database": ["Orders table"],
        "external": []
      },
      "dependencies": ["order-placement-slice"],
      "estimated_effort": "1 week"
    }
  ],
  "epics": [
    {
      "id": "epic-order-lifecycle",
      "name": "Order Lifecycle Management",
      "description": "Enable customers to place, track, and manage orders",
      "journeys": ["place-order", "track-order"],
      "vertical_slices": ["order-placement-slice", "order-tracking-slice"],
      "bounded_contexts": ["order-management", "inventory", "payment", "notification"],
      "acceptance_criteria": [
        "Customers can place orders",
        "Inventory is reserved automatically",
        "Payments are processed securely",
        "Customers receive email confirmations",
        "Customers can track order status"
      ],
      "priority": "high",
      "estimated_effort": "3 weeks"
    }
  ],
  "stories": [
    {
      "id": "story-order-001",
      "title": "Customer can add products to cart",
      "story": "As a customer, I want to add products to my cart so that I can purchase multiple items",
      "epic": "epic-order-lifecycle",
      "bounded_context": "order-management",
      "acceptance_criteria": [
        "Product can be added to cart",
        "Quantity can be specified",
        "Cart persists across sessions",
        "Out-of-stock products show warning"
      ],
      "dependencies": [],
      "parallel": true,
      "estimated_effort": "2 days",
      "technical_notes": "Use session storage for cart persistence"
    },
    {
      "id": "story-order-002",
      "title": "System reserves inventory when order is placed",
      "story": "As a system, I want to reserve inventory when an order is placed so that stock is not oversold",
      "epic": "epic-order-lifecycle",
      "bounded_context": "inventory",
      "acceptance_criteria": [
        "Stock is reserved when order is created",
        "Reserved stock is deducted from available quantity",
        "Reservation expires after 15 minutes if payment not completed",
        "Stock is released if order is cancelled"
      ],
      "dependencies": [],
      "parallel": true,
      "estimated_effort": "3 days",
      "technical_notes": "Implement reservation timeout mechanism"
    },
    {
      "id": "story-order-003",
      "title": "Customer can complete checkout with payment",
      "story": "As a customer, I want to pay for my order so that I can complete my purchase",
      "epic": "epic-order-lifecycle",
      "bounded_context": "payment",
      "acceptance_criteria": [
        "Payment form accepts credit card details",
        "Payment is processed via payment gateway",
        "Order status updates to 'confirmed' on successful payment",
        "Payment failure shows clear error message"
      ],
      "dependencies": ["story-order-001", "story-order-002"],
      "parallel": false,
      "estimated_effort": "3 days",
      "technical_notes": "Integrate with Stripe API"
    },
    {
      "id": "story-order-004",
      "title": "Customer receives order confirmation email",
      "story": "As a customer, I want to receive an email confirmation so that I have a record of my order",
      "epic": "epic-order-lifecycle",
      "bounded_context": "notification",
      "acceptance_criteria": [
        "Email sent immediately after order placement",
        "Email includes order number, items, total, and shipping address",
        "Email template is branded",
        "Failed email sends are logged"
      ],
      "dependencies": ["story-order-003"],
      "parallel": false,
      "estimated_effort": "2 days",
      "technical_notes": "Use SendGrid for email delivery"
    },
    {
      "id": "story-order-005",
      "title": "Customer can view order history",
      "story": "As a customer, I want to view my order history so that I can track past purchases",
      "epic": "epic-order-lifecycle",
      "bounded_context": "order-management",
      "acceptance_criteria": [
        "Order history page shows all customer orders",
        "Orders are sorted by date (newest first)",
        "Each order shows status, total, and date",
        "Clicking order navigates to detail page"
      ],
      "dependencies": ["story-order-003"],
      "parallel": true,
      "estimated_effort": "2 days",
      "technical_notes": "Implement pagination for large order lists"
    }
  ],
  "bounded_context_mapping": {
    "order-management": {
      "stories": ["story-order-001", "story-order-005"],
      "epics": ["epic-order-lifecycle"],
      "vertical_slices": ["order-placement-slice", "order-tracking-slice"]
    },
    "inventory": {
      "stories": ["story-order-002"],
      "epics": ["epic-order-lifecycle"],
      "vertical_slices": ["order-placement-slice"]
    },
    "payment": {
      "stories": ["story-order-003"],
      "epics": ["epic-order-lifecycle"],
      "vertical_slices": ["order-placement-slice"]
    },
    "notification": {
      "stories": ["story-order-004"],
      "epics": ["epic-order-lifecycle"],
      "vertical_slices": ["order-placement-slice"]
    }
  }
}
```

---

## Stage 3: Prioritization

**Agent**: OpenCoder (orchestrator) + PrioritizationEngine

**CLI Command**:
```bash
# OpenCoder delegates to PrioritizationEngine
task(
  subagent_type="PrioritizationEngine",
  description="Prioritize Order Management backlog",
  prompt="Score and prioritize stories from map.json using RICE and WSJF.
          Identify MVP vs. post-MVP features.
          Context: E-commerce order system, 100k users, Q1 2026 launch."
)
```

### PrioritizationEngine Output

**File**: `.tmp/planning/prioritized.json`

```json
{
  "metadata": {
    "generated_at": "2026-02-14T11:00:00Z",
    "source": "StoryMapper output",
    "frameworks": ["RICE", "WSJF"],
    "total_items": 5,
    "mvp_count": 4,
    "post_mvp_count": 1
  },
  "scoring_criteria": {
    "rice": {
      "reach_period": "per quarter",
      "impact_scale": "0.25 (minimal) to 3.0 (massive)",
      "confidence_scale": "0-100%",
      "effort_unit": "person-months"
    },
    "wsjf": {
      "business_value_scale": "1-10",
      "time_criticality_scale": "1-10",
      "risk_reduction_scale": "1-10",
      "job_size_scale": "1-10 (inverse effort)"
    }
  },
  "mvp_features": [
    {
      "id": "story-order-001",
      "title": "Customer can add products to cart",
      "epic": "Order Lifecycle Management",
      "rice_score": {
        "reach": 80000,
        "impact": 3.0,
        "confidence": 90,
        "effort": 0.2,
        "score": 1080000,
        "justification": {
          "reach": "80% of 100k users add to cart quarterly",
          "impact": "Core value proposition - cannot purchase without cart",
          "confidence": "Standard e-commerce feature, well understood",
          "effort": "2 days = 0.2 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 10,
        "time_criticality": 10,
        "risk_reduction": 8,
        "job_size": 9,
        "score": 3.11,
        "justification": {
          "business_value": "Critical - no cart = no sales",
          "time_criticality": "Immediate - required for launch",
          "risk_reduction": "Enables all downstream features",
          "job_size": "2 days = tiny effort"
        }
      },
      "combined_rank": 1,
      "mvp_reason": "Core value proposition, dependency blocker for checkout",
      "estimated_effort": "2 days",
      "dependencies": []
    },
    {
      "id": "story-order-002",
      "title": "System reserves inventory when order is placed",
      "epic": "Order Lifecycle Management",
      "rice_score": {
        "reach": 50000,
        "impact": 2.0,
        "confidence": 80,
        "effort": 0.3,
        "score": 266667,
        "justification": {
          "reach": "50% of users complete checkout quarterly",
          "impact": "High - prevents overselling and customer complaints",
          "confidence": "Common pattern, some complexity in timeout logic",
          "effort": "3 days = 0.3 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 9,
        "time_criticality": 9,
        "risk_reduction": 9,
        "job_size": 8,
        "score": 3.38,
        "justification": {
          "business_value": "Critical - prevents overselling",
          "time_criticality": "Urgent - required for launch",
          "risk_reduction": "High - prevents inventory issues",
          "job_size": "3 days = tiny effort"
        }
      },
      "combined_rank": 2,
      "mvp_reason": "Prevents overselling, critical for business integrity",
      "estimated_effort": "3 days",
      "dependencies": []
    },
    {
      "id": "story-order-003",
      "title": "Customer can complete checkout with payment",
      "epic": "Order Lifecycle Management",
      "rice_score": {
        "reach": 50000,
        "impact": 3.0,
        "confidence": 85,
        "effort": 0.3,
        "score": 425000,
        "justification": {
          "reach": "50% of users complete checkout quarterly",
          "impact": "Massive - direct revenue driver",
          "confidence": "High - Stripe integration is well documented",
          "effort": "3 days = 0.3 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 10,
        "time_criticality": 10,
        "risk_reduction": 7,
        "job_size": 8,
        "score": 3.38,
        "justification": {
          "business_value": "Critical - no payment = no revenue",
          "time_criticality": "Immediate - required for launch",
          "risk_reduction": "Medium - payment gateway handles most risk",
          "job_size": "3 days = tiny effort"
        }
      },
      "combined_rank": 3,
      "mvp_reason": "Direct revenue driver, core value proposition",
      "estimated_effort": "3 days",
      "dependencies": ["story-order-001", "story-order-002"]
    },
    {
      "id": "story-order-004",
      "title": "Customer receives order confirmation email",
      "epic": "Order Lifecycle Management",
      "rice_score": {
        "reach": 50000,
        "impact": 1.0,
        "confidence": 90,
        "effort": 0.2,
        "score": 225000,
        "justification": {
          "reach": "50% of users complete checkout quarterly",
          "impact": "Medium - improves customer experience, not critical",
          "confidence": "High - SendGrid integration is straightforward",
          "effort": "2 days = 0.2 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 7,
        "time_criticality": 8,
        "risk_reduction": 5,
        "job_size": 9,
        "score": 2.22,
        "justification": {
          "business_value": "Medium - improves trust and reduces support load",
          "time_criticality": "Moderate urgency - customers expect confirmation",
          "risk_reduction": "Low - reduces support inquiries",
          "job_size": "2 days = tiny effort"
        }
      },
      "combined_rank": 4,
      "mvp_reason": "Customer expectation, reduces support load",
      "estimated_effort": "2 days",
      "dependencies": ["story-order-003"]
    }
  ],
  "post_mvp_features": [
    {
      "id": "story-order-005",
      "title": "Customer can view order history",
      "epic": "Order Lifecycle Management",
      "rice_score": {
        "reach": 30000,
        "impact": 0.5,
        "confidence": 80,
        "effort": 0.2,
        "score": 60000,
        "justification": {
          "reach": "30% of users view order history quarterly",
          "impact": "Low - nice-to-have, not essential for first purchase",
          "confidence": "High - standard CRUD operation",
          "effort": "2 days = 0.2 person-months"
        }
      },
      "wsjf_score": {
        "business_value": 5,
        "time_criticality": 4,
        "risk_reduction": 3,
        "job_size": 9,
        "score": 1.33,
        "justification": {
          "business_value": "Low - improves UX but not critical",
          "time_criticality": "Low urgency - can be added post-launch",
          "risk_reduction": "Low - no significant risk reduction",
          "job_size": "2 days = tiny effort"
        }
      },
      "combined_rank": 5,
      "post_mvp_reason": "Enhancement, not essential for core order flow",
      "estimated_effort": "2 days",
      "dependencies": ["story-order-003"]
    }
  ],
  "release_recommendations": {
    "mvp_timeline": "2 weeks (sum of MVP efforts: 10 days)",
    "mvp_scope": "Core order placement flow with cart, inventory, payment, and confirmation",
    "post_mvp_phases": [
      {
        "phase": "Phase 2",
        "timeline": "1 week",
        "features": ["story-order-005"],
        "theme": "Order history and tracking"
      }
    ]
  }
}
```

---

## Stage 4: Enhanced Task Breakdown

**Agent**: TaskManager + ContextScout

**CLI Command**:
```bash
# OpenCoder delegates to TaskManager
task(
  subagent_type="TaskManager",
  description="Create tasks for Order Management MVP",
  prompt="Create implementation tasks for Order Management MVP.
          Use contexts.json for bounded contexts.
          Use map.json for stories.
          Use prioritized.json for MVP scope.
          Focus on MVP features only (stories 001-004)."
)
```

### TaskManager Output

**File**: `.tmp/tasks/order-management-mvp/task.json`

```json
{
  "id": "order-management-mvp",
  "name": "Order Management MVP",
  "status": "active",
  "objective": "Implement core order placement flow with cart, inventory, payment, and confirmation",
  "context_files": [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md",
    ".opencode/context/core/workflows/multi-stage-orchestration.md"
  ],
  "reference_files": [
    "src/api/base.controller.ts",
    "src/database/base.repository.ts"
  ],
  "exit_criteria": [
    "All MVP stories implemented (001-004)",
    "Integration tests passing",
    "Payment gateway integrated",
    "Email notifications working"
  ],
  "subtask_count": 12,
  "completed_count": 0,
  "created_at": "2026-02-14T11:30:00Z",
  "bounded_context": "order-management",
  "module": "@app/orders",
  "vertical_slice": "order-placement-slice",
  "contracts": [
    {
      "type": "api",
      "name": "OrderAPI",
      "path": "src/api/orders/order.contract.ts",
      "status": "defined"
    },
    {
      "type": "api",
      "name": "InventoryAPI",
      "path": "src/api/inventory/inventory.contract.ts",
      "status": "defined"
    },
    {
      "type": "api",
      "name": "PaymentAPI",
      "path": "src/api/payment/payment.contract.ts",
      "status": "defined"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-001",
      "path": "docs/adr/001-event-driven-architecture.md",
      "title": "Use event-driven architecture for cross-context communication"
    },
    {
      "id": "ADR-002",
      "path": "docs/adr/002-stripe-payment-gateway.md",
      "title": "Use Stripe as payment gateway"
    }
  ],
  "rice_score": {
    "reach": 50000,
    "impact": 3.0,
    "confidence": 85,
    "effort": 1.2,
    "score": 106250
  },
  "wsjf_score": {
    "business_value": 10,
    "time_criticality": 10,
    "risk_reduction": 8,
    "job_size": 5,
    "score": 5.6
  },
  "release_slice": "v1.0.0"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_01.json`

```json
{
  "id": "order-management-mvp-01",
  "seq": "01",
  "title": "Setup project structure and install dependencies",
  "status": "pending",
  "depends_on": [],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "24-50",
      "reason": "Modular design and component structure patterns"
    }
  ],
  "reference_files": ["package.json"],
  "acceptance_criteria": [
    "Project structure follows modular design",
    "Dependencies installed (Express, TypeScript, Stripe, SendGrid)",
    "TypeScript configured with strict mode",
    "ESLint and Prettier configured"
  ],
  "deliverables": [
    "src/orders/",
    "src/inventory/",
    "src/payment/",
    "src/notification/",
    "package.json",
    "tsconfig.json"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_02.json`

```json
{
  "id": "order-management-mvp-02",
  "seq": "02",
  "title": "Define TypeScript interfaces and contracts",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-95",
      "reason": "Pure function and immutability patterns"
    }
  ],
  "reference_files": [
    ".tmp/tasks/order-management-system/contexts.json"
  ],
  "acceptance_criteria": [
    "Order, LineItem, Product interfaces defined",
    "OrderService, InventoryService, PaymentService contracts defined",
    "Domain events defined (OrderPlaced, StockReserved, etc.)",
    "All interfaces use immutable types"
  ],
  "deliverables": [
    "src/orders/types/order.types.ts",
    "src/orders/types/events.types.ts",
    "src/contracts/order-service.contract.ts",
    "src/contracts/inventory-service.contract.ts",
    "src/contracts/payment-service.contract.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders",
  "contracts": [
    {
      "type": "interface",
      "name": "OrderService",
      "path": "src/contracts/order-service.contract.ts",
      "status": "defined"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-001",
      "path": "docs/adr/001-event-driven-architecture.md"
    }
  ]
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_03.json`

```json
{
  "id": "order-management-mvp-03",
  "seq": "03",
  "title": "Implement shopping cart service",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-72",
      "reason": "Pure function patterns for cart operations"
    },
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "64-72",
      "reason": "Immutability patterns for cart state"
    }
  ],
  "reference_files": [
    "src/contracts/order-service.contract.ts"
  ],
  "acceptance_criteria": [
    "Cart service uses pure functions",
    "Cart state is immutable",
    "Add/remove/update item operations work correctly",
    "Cart persists to session storage",
    "Unit tests cover all cart operations"
  ],
  "deliverables": [
    "src/orders/services/cart.service.ts",
    "src/orders/services/cart.service.test.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_04.json`

```json
{
  "id": "order-management-mvp-04",
  "seq": "04",
  "title": "Implement inventory reservation service",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-72",
      "reason": "Pure function patterns"
    },
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "80-120",
      "reason": "Transaction handling and race condition prevention"
    }
  ],
  "reference_files": [
    "src/contracts/inventory-service.contract.ts"
  ],
  "acceptance_criteria": [
    "Stock reservation uses database transactions",
    "Reservation timeout mechanism implemented (15 minutes)",
    "Race conditions prevented with optimistic locking",
    "StockReserved and StockReleased events emitted",
    "Unit tests cover reservation logic"
  ],
  "deliverables": [
    "src/inventory/services/reservation.service.ts",
    "src/inventory/services/reservation.service.test.ts"
  ],
  "bounded_context": "inventory",
  "module": "@app/inventory",
  "contracts": [
    {
      "type": "interface",
      "name": "InventoryService",
      "path": "src/contracts/inventory-service.contract.ts",
      "status": "implemented"
    }
  ]
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_05.json`

```json
{
  "id": "order-management-mvp-05",
  "seq": "05",
  "title": "Implement payment service with Stripe integration",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "40-80",
      "reason": "API key management and secure payment handling"
    }
  ],
  "reference_files": [
    "src/contracts/payment-service.contract.ts"
  ],
  "acceptance_criteria": [
    "Stripe SDK integrated",
    "Payment processing uses Stripe API",
    "API keys stored securely in environment variables",
    "Payment errors handled gracefully",
    "PaymentProcessed and PaymentFailed events emitted",
    "Unit tests use Stripe test mode"
  ],
  "deliverables": [
    "src/payment/services/payment.service.ts",
    "src/payment/services/payment.service.test.ts"
  ],
  "bounded_context": "payment",
  "module": "@app/payment",
  "contracts": [
    {
      "type": "interface",
      "name": "PaymentService",
      "path": "src/contracts/payment-service.contract.ts",
      "status": "implemented"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-002",
      "path": "docs/adr/002-stripe-payment-gateway.md"
    }
  ]
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_06.json`

```json
{
  "id": "order-management-mvp-06",
  "seq": "06",
  "title": "Implement notification service with SendGrid",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "106-124",
      "reason": "Error handling patterns for external API calls"
    }
  ],
  "reference_files": [],
  "acceptance_criteria": [
    "SendGrid SDK integrated",
    "Email templates created for order confirmation",
    "Email sending uses SendGrid API",
    "Failed email sends are logged",
    "EmailSent events emitted",
    "Unit tests mock SendGrid API"
  ],
  "deliverables": [
    "src/notification/services/email.service.ts",
    "src/notification/services/email.service.test.ts",
    "src/notification/templates/order-confirmation.html"
  ],
  "bounded_context": "notification",
  "module": "@app/notification"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_07.json`

```json
{
  "id": "order-management-mvp-07",
  "seq": "07",
  "title": "Implement order service orchestrating cart, inventory, payment",
  "status": "pending",
  "depends_on": ["03", "04", "05"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "127-142",
      "reason": "Dependency injection patterns"
    }
  ],
  "reference_files": [
    "src/orders/services/cart.service.ts",
    "src/inventory/services/reservation.service.ts",
    "src/payment/services/payment.service.ts"
  ],
  "acceptance_criteria": [
    "Order service uses dependency injection",
    "Place order workflow: validate cart → reserve inventory → process payment → create order",
    "Rollback logic if payment fails (release inventory)",
    "OrderPlaced event emitted on success",
    "Error handling for each step",
    "Unit tests cover happy path and error scenarios"
  ],
  "deliverables": [
    "src/orders/services/order.service.ts",
    "src/orders/services/order.service.test.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders",
  "contracts": [
    {
      "type": "interface",
      "name": "OrderService",
      "path": "src/contracts/order-service.contract.ts",
      "status": "implemented"
    }
  ]
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_08.json`

```json
{
  "id": "order-management-mvp-08",
  "seq": "08",
  "title": "Create REST API endpoints for orders",
  "status": "pending",
  "depends_on": ["07"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "106-124",
      "reason": "Error handling and validation patterns"
    }
  ],
  "reference_files": [
    "src/api/base.controller.ts",
    "src/orders/services/order.service.ts"
  ],
  "acceptance_criteria": [
    "POST /api/orders endpoint creates order",
    "GET /api/orders/:id endpoint retrieves order",
    "Request validation middleware applied",
    "Error responses follow standard format",
    "API tests cover all endpoints"
  ],
  "deliverables": [
    "src/api/orders/order.controller.ts",
    "src/api/orders/order.routes.ts",
    "src/api/orders/order.controller.test.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_09.json`

```json
{
  "id": "order-management-mvp-09",
  "seq": "09",
  "title": "Implement event handler for order confirmation emails",
  "status": "pending",
  "depends_on": ["06", "07"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "106-124",
      "reason": "Error handling for async operations"
    }
  ],
  "reference_files": [
    "src/notification/services/email.service.ts"
  ],
  "acceptance_criteria": [
    "Event handler subscribes to OrderPlaced events",
    "Handler sends confirmation email on OrderPlaced",
    "Email includes order details from event payload",
    "Failed email sends are logged but don't block order creation",
    "Unit tests mock event bus and email service"
  ],
  "deliverables": [
    "src/notification/handlers/order-placed.handler.ts",
    "src/notification/handlers/order-placed.handler.test.ts"
  ],
  "bounded_context": "notification",
  "module": "@app/notification",
  "related_adrs": [
    {
      "id": "ADR-001",
      "path": "docs/adr/001-event-driven-architecture.md"
    }
  ]
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_10.json`

```json
{
  "id": "order-management-mvp-10",
  "seq": "10",
  "title": "Create database schema and migrations",
  "status": "pending",
  "depends_on": ["02"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [],
  "reference_files": [
    "src/database/base.repository.ts",
    "src/orders/types/order.types.ts"
  ],
  "acceptance_criteria": [
    "Orders table created with proper indexes",
    "LineItems table created with foreign key to Orders",
    "Inventory table created with stock tracking",
    "Migrations are reversible",
    "Database constraints enforce invariants"
  ],
  "deliverables": [
    "migrations/001_create_orders_table.sql",
    "migrations/002_create_line_items_table.sql",
    "migrations/003_create_inventory_table.sql"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_11.json`

```json
{
  "id": "order-management-mvp-11",
  "seq": "11",
  "title": "Create integration tests for order placement flow",
  "status": "pending",
  "depends_on": ["08", "09", "10"],
  "parallel": false,
  "suggested_agent": "CoderAgent",
  "context_files": [],
  "reference_files": [
    "src/api/orders/order.controller.ts",
    "src/orders/services/order.service.ts"
  ],
  "acceptance_criteria": [
    "End-to-end test: add to cart → checkout → payment → confirmation email",
    "Test covers happy path",
    "Test covers payment failure scenario",
    "Test covers out-of-stock scenario",
    "All tests pass"
  ],
  "deliverables": [
    "tests/integration/order-placement.test.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**File**: `.tmp/tasks/order-management-mvp/subtask_12.json`

```json
{
  "id": "order-management-mvp-12",
  "seq": "12",
  "title": "Create API documentation with OpenAPI spec",
  "status": "pending",
  "depends_on": ["08"],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [],
  "reference_files": [
    "src/api/orders/order.routes.ts"
  ],
  "acceptance_criteria": [
    "OpenAPI 3.0 spec created",
    "All endpoints documented",
    "Request/response schemas defined",
    "Example requests/responses provided",
    "Swagger UI accessible at /api-docs"
  ],
  "deliverables": [
    "docs/api/openapi.yaml",
    "src/api/swagger.config.ts"
  ],
  "bounded_context": "order-management",
  "module": "@app/orders"
}
```

**CLI Validation**:
```bash
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  validate order-management-mvp

# Output:
# ✅ Task JSON valid
# ✅ All subtasks have dependencies resolved
# ✅ Parallel batches identified: 4 batches
#   Batch 1: [01]
#   Batch 2: [03, 04, 05, 06, 10]
#   Batch 3: [07]
#   Batch 4: [08, 12]
#   Batch 5: [09]
#   Batch 6: [11]
```

---

## Stage 5: Contract Definition

**Agent**: OpenCoder (orchestrator) + ContractManager

**CLI Command**:
```bash
# OpenCoder delegates to ContractManager
task(
  subagent_type="ContractManager",
  description="Define API contracts for Order Management",
  prompt="Create API contracts for Order, Inventory, and Payment services.
          Use bounded contexts from contexts.json.
          Enable parallel frontend/backend development.
          Output: OpenAPI 3.0 specs and contract.json files."
)
```

### ContractManager Output

**File**: `.tmp/contracts/order-management/order-api/contract.json`

```json
{
  "contract_id": "order-api",
  "version": "1.0.0",
  "bounded_context": "order-management",
  "service_name": "OrderAPI",
  "description": "REST API for order management operations",
  "openapi_spec_path": "contract.openapi.yaml",
  "consumers": [
    {
      "name": "web-frontend",
      "type": "spa",
      "endpoints_used": ["/orders", "/orders/{id}"],
      "authentication": "JWT"
    }
  ],
  "providers": [
    {
      "name": "order-service",
      "type": "rest-api",
      "implementation_path": "src/api/orders",
      "technology": "Node.js/Express"
    }
  ],
  "testing_strategy": {
    "approach": "consumer-driven",
    "framework": "pact",
    "consumer_tests": [
      {
        "consumer": "web-frontend",
        "test_path": "tests/contracts/order-api.pact.spec.ts",
        "scenarios": [
          "Create order - success",
          "Create order - payment failure",
          "Get order by ID - success",
          "Get order by ID - not found"
        ]
      }
    ],
    "provider_verification": {
      "provider": "order-service",
      "verification_path": "tests/contracts/verify-pacts.spec.ts",
      "run_on": "pre-commit, CI/CD"
    }
  },
  "mock_server": {
    "enabled": true,
    "tool": "prism",
    "command": "prism mock contract.openapi.yaml",
    "port": 4010,
    "purpose": "Enable frontend development before backend implementation"
  },
  "versioning": {
    "scheme": "semantic",
    "current_version": "1.0.0",
    "breaking_change_policy": "new major version required",
    "deprecation_policy": "6 months notice, support N-1 versions",
    "version_in_url": true,
    "version_in_header": false,
    "changelog_path": "docs/api/changelog.md"
  },
  "evolution_rules": {
    "safe_changes": [
      "Add new optional fields to responses",
      "Add new endpoints",
      "Add new optional query parameters"
    ],
    "breaking_changes": [
      "Remove or rename fields",
      "Change field types",
      "Remove endpoints",
      "Make optional fields required"
    ],
    "migration_support": {
      "dual_version_support": true,
      "migration_guide_required": true,
      "migration_guide_path": "docs/api/migrations/"
    }
  },
  "created_at": "2026-02-14T12:00:00Z",
  "updated_at": "2026-02-14T12:00:00Z"
}
```

**File**: `.tmp/contracts/order-management/order-api/contract.openapi.yaml`

```yaml
openapi: 3.0.3
info:
  title: Order Management API
  version: 1.0.0
  description: REST API for managing e-commerce orders
servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://api-staging.example.com/v1
    description: Staging
  - url: http://localhost:4010
    description: Mock Server

paths:
  /orders:
    post:
      summary: Create a new order
      operationId: createOrder
      tags:
        - Orders
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            example:
              customerId: "cust_123"
              items:
                - productId: "prod_456"
                  quantity: 2
                  price: 29.99
              shippingAddress:
                street: "123 Main St"
                city: "San Francisco"
                state: "CA"
                zip: "94102"
              paymentMethod:
                type: "card"
                token: "tok_visa"
      responses:
        '201':
          description: Order created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
              example:
                id: "ord_789"
                customerId: "cust_123"
                status: "confirmed"
                items:
                  - productId: "prod_456"
                    quantity: 2
                    price: 29.99
                total: 59.98
                createdAt: "2026-02-14T12:00:00Z"
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
        '402':
          description: Payment Failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: Out of Stock
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /orders/{id}:
    get:
      summary: Get order by ID
      operationId: getOrder
      tags:
        - Orders
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: Order ID
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '401':
          description: Unauthorized
        '404':
          description: Order not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    CreateOrderRequest:
      type: object
      required:
        - customerId
        - items
        - shippingAddress
        - paymentMethod
      properties:
        customerId:
          type: string
          description: Customer ID
        items:
          type: array
          items:
            $ref: '#/components/schemas/LineItem'
          minItems: 1
        shippingAddress:
          $ref: '#/components/schemas/Address'
        paymentMethod:
          $ref: '#/components/schemas/PaymentMethod'

    Order:
      type: object
      required:
        - id
        - customerId
        - status
        - items
        - total
        - createdAt
      properties:
        id:
          type: string
          format: uuid
        customerId:
          type: string
        status:
          type: string
          enum: [pending, confirmed, shipped, delivered, cancelled]
        items:
          type: array
          items:
            $ref: '#/components/schemas/LineItem'
        total:
          type: number
          format: double
        shippingAddress:
          $ref: '#/components/schemas/Address'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    LineItem:
      type: object
      required:
        - productId
        - quantity
        - price
      properties:
        productId:
          type: string
        quantity:
          type: integer
          minimum: 1
        price:
          type: number
          format: double

    Address:
      type: object
      required:
        - street
        - city
        - state
        - zip
      properties:
        street:
          type: string
        city:
          type: string
        state:
          type: string
        zip:
          type: string

    PaymentMethod:
      type: object
      required:
        - type
        - token
      properties:
        type:
          type: string
          enum: [card, paypal]
        token:
          type: string
          description: Payment token from payment gateway

    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

**Similar contracts created for**:
- `.tmp/contracts/inventory/inventory-api/` (Inventory API)
- `.tmp/contracts/payment/payment-api/` (Payment API)

---

## Stage 6: Parallel Execution

**Agent**: BatchExecutor → CoderAgent (multiple simultaneous)

**CLI Commands**:

```bash
# Identify parallel batches
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  parallel order-management-mvp

# Output:
# Batch 1 (1 task): [01]
# Batch 2 (5 tasks): [03, 04, 05, 06, 10]
# Batch 3 (1 task): [07]
# Batch 4 (2 tasks): [08, 12]
# Batch 5 (1 task): [09]
# Batch 6 (1 task): [11]
```

### Batch 1 Execution

**BatchExecutor delegates**: Task 01 to CoderAgent

**CoderAgent workflow**:
1. Loads context from `.opencode/context/core/standards/code-quality.md` (lines 24-50)
2. Reads reference file `package.json`
3. Implements deliverables:
   - Creates modular directory structure
   - Installs dependencies (Express, TypeScript, Stripe, SendGrid)
   - Configures TypeScript with strict mode
   - Sets up ESLint and Prettier
4. Self-review:
   - ✅ Types clean (TypeScript strict mode enabled)
   - ✅ Imports verified (all dependencies in package.json)
   - ✅ No debug artifacts
   - ✅ All acceptance criteria met
5. Marks task complete:
   ```bash
   bash .opencode/skills/task-management/router.sh complete \
     order-management-mvp 01 "Project structure and dependencies configured"
   ```

**BatchExecutor verifies**: Task 01 marked complete, deliverables exist

### Batch 2 Execution (Parallel)

**BatchExecutor delegates**: Tasks 03, 04, 05, 06, 10 to five CoderAgents simultaneously

**CoderAgent 1** (Task 03 - Cart Service):
- Loads context: code-quality.md (lines 53-72 for pure functions, 64-72 for immutability)
- Reads reference: `src/contracts/order-service.contract.ts`
- Implements: `src/orders/services/cart.service.ts` with pure functions and immutable state
- Self-review: ✅ All checks pass
- Marks complete: "Shopping cart service with pure functions and immutable state"

**CoderAgent 2** (Task 04 - Inventory Reservation):
- Loads context: code-quality.md (lines 53-72), security-patterns.md (lines 80-120)
- Reads reference: `src/contracts/inventory-service.contract.ts`
- Implements: `src/inventory/services/reservation.service.ts` with transaction handling
- Self-review: ✅ All checks pass
- Marks complete: "Inventory reservation with timeout and optimistic locking"

**CoderAgent 3** (Task 05 - Payment Service):
- Loads context: security-patterns.md (lines 40-80)
- Reads reference: `src/contracts/payment-service.contract.ts`
- Calls ExternalScout for Stripe API docs
- Implements: `src/payment/services/payment.service.ts` with Stripe integration
- Self-review: ✅ All checks pass
- Marks complete: "Payment service with Stripe integration and secure API key handling"

**CoderAgent 4** (Task 06 - Notification Service):
- Loads context: code-quality.md (lines 106-124)
- Calls ExternalScout for SendGrid API docs
- Implements: `src/notification/services/email.service.ts` with SendGrid
- Self-review: ✅ All checks pass
- Marks complete: "Email notification service with SendGrid and error logging"

**CoderAgent 5** (Task 10 - Database Schema):
- Reads reference: `src/database/base.repository.ts`, `src/orders/types/order.types.ts`
- Implements: Database migrations for Orders, LineItems, Inventory tables
- Self-review: ✅ All checks pass
- Marks complete: "Database schema with proper indexes and constraints"

**BatchExecutor verifies**: All 5 tasks in Batch 2 marked complete

### Batch 3 Execution

**BatchExecutor delegates**: Task 07 to CoderAgent

**CoderAgent workflow**:
- Loads context: code-quality.md (lines 127-142 for dependency injection)
- Reads references: cart.service.ts, reservation.service.ts, payment.service.ts
- Implements: `src/orders/services/order.service.ts` orchestrating all services
- Implements rollback logic for payment failures
- Self-review: ✅ All checks pass
- Marks complete: "Order service with dependency injection and rollback logic"

### Batch 4 Execution (Parallel)

**BatchExecutor delegates**: Tasks 08, 12 to two CoderAgents simultaneously

**CoderAgent 1** (Task 08 - REST API):
- Implements: `src/api/orders/order.controller.ts` with validation middleware
- Self-review: ✅ All checks pass
- Marks complete: "REST API endpoints with validation and error handling"

**CoderAgent 2** (Task 12 - API Documentation):
- Implements: `docs/api/openapi.yaml` and Swagger UI config
- Self-review: ✅ All checks pass
- Marks complete: "OpenAPI spec with Swagger UI"

### Batch 5 Execution

**BatchExecutor delegates**: Task 09 to CoderAgent

**CoderAgent workflow**:
- Implements: `src/notification/handlers/order-placed.handler.ts`
- Self-review: ✅ All checks pass
- Marks complete: "Event handler for order confirmation emails"

### Batch 6 Execution

**BatchExecutor delegates**: Task 11 to CoderAgent

**CoderAgent workflow**:
- Implements: `tests/integration/order-placement.test.ts`
- Runs tests: All pass
- Self-review: ✅ All checks pass
- Marks complete: "Integration tests for order placement flow"

**Final Status**:
```bash
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  status order-management-mvp

# Output:
# [order-management-mvp] Order Management MVP
#   Status: active | Progress: 100% (12/12)
#   Pending: 0 | In Progress: 0 | Completed: 12 | Blocked: 0
```

---

## Stage 7: Integration & Validation

**Agent**: OpenCoder (orchestrator) + CoderAgent + TestEngineer

### Integration Steps

1. **Wire Components Together**
   - Connect Order Service to Cart, Inventory, Payment services
   - Configure event bus for domain events
   - Set up dependency injection container

2. **Run Integration Tests**
   ```bash
   npm run test:integration
   
   # Output:
   # ✅ Order placement flow - happy path
   # ✅ Order placement flow - payment failure
   # ✅ Order placement flow - out of stock
   # ✅ Email notification on order placed
   # All tests passing (4/4)
   ```

3. **Validate Against Requirements**
   - ✅ Customers can add products to cart
   - ✅ Inventory is reserved automatically
   - ✅ Payments are processed securely via Stripe
   - ✅ Customers receive email confirmations
   - ✅ Order status tracking works

4. **Performance Testing**
   ```bash
   npm run test:performance
   
   # Output:
   # Order placement time: 1.2s (target: < 2s) ✅
   # Inventory reservation time: 0.3s ✅
   # Payment processing time: 0.8s ✅
   ```

5. **Security Review**
   - ✅ API keys stored in environment variables
   - ✅ JWT authentication on all endpoints
   - ✅ Input validation on all requests
   - ✅ SQL injection prevention via parameterized queries
   - ✅ XSS prevention via output encoding

### Validation Report

**File**: `.tmp/validation/order-management-mvp-report.md`

```markdown
# Order Management MVP - Validation Report

**Date**: 2026-02-14
**Status**: ✅ PASSED

## Acceptance Criteria

- ✅ All MVP stories implemented (001-004)
- ✅ Integration tests passing (4/4)
- ✅ Payment gateway integrated (Stripe)
- ✅ Email notifications working (SendGrid)

## Performance Metrics

- Order placement time: 1.2s (target: < 2s) ✅
- Order success rate: 98% (target: 95%) ✅
- Inventory update latency: 0.3s ✅

## Security Review

- ✅ API keys secured
- ✅ Authentication enforced
- ✅ Input validation implemented
- ✅ SQL injection prevented
- ✅ XSS prevention in place

## Issues Found

None

## Recommendation

**APPROVED FOR RELEASE**
```

---

## Stage 8: Release & Learning

**Agent**: OpenCoder (orchestrator)

### Release Process

1. **Prepare Release**
   - Final code review
   - Update documentation
   - Create release notes
   - Tag version: `v1.0.0`

2. **Deploy to Staging**
   ```bash
   npm run deploy:staging
   
   # Output:
   # ✅ Database migrations applied
   # ✅ Application deployed
   # ✅ Health checks passing
   # ✅ Smoke tests passing
   ```

3. **Deploy to Production**
   ```bash
   npm run deploy:production
   
   # Output:
   # ✅ Blue-green deployment initiated
   # ✅ Traffic shifted to new version
   # ✅ Health checks passing
   # ✅ Monitoring active
   ```

4. **Monitor Production**
   - Order success rate: 97% (first 24 hours)
   - Average order placement time: 1.4s
   - Email delivery rate: 99%
   - No critical errors

### Lessons Learned

**File**: `docs/retrospectives/order-management-mvp.md`

```markdown
# Order Management MVP - Retrospective

**Date**: 2026-02-15
**Team**: OpenCoder, TaskManager, BatchExecutor, CoderAgent

## What Went Well

1. **Multi-Stage Orchestration Workflow**
   - Architecture decomposition identified clear bounded contexts
   - Story mapping aligned features with user journeys
   - Prioritization ensured MVP focus
   - Enhanced task breakdown enabled parallel execution

2. **Parallel Execution**
   - Batch 2 (5 tasks) completed simultaneously, saving 8 days
   - Contract-first design enabled frontend/backend parallel work
   - No integration conflicts due to clear contracts

3. **Quality**
   - Self-review loop caught issues before integration
   - Integration tests validated end-to-end flows
   - Performance targets met on first deployment

## What Could Be Improved

1. **Planning Phase**
   - Could have identified more parallel opportunities in Batch 3-6
   - ADR creation could have been done earlier (before implementation)

2. **Testing**
   - Could have added more edge case tests
   - Performance testing could have been more comprehensive

3. **Documentation**
   - API documentation could have been created earlier (parallel with contracts)

## Action Items

1. **Update Standards**
   - Document parallel execution patterns in `.opencode/context/core/workflows/`
   - Add contract-first design guide
   - Create ADR template for future features

2. **Improve Tooling**
   - Enhance task-cli.ts to suggest optimal parallel batches
   - Add performance testing to CI/CD pipeline

3. **Knowledge Sharing**
   - Share this workflow example with team
   - Create training materials on multi-stage orchestration

## Metrics

- **Planning Time**: 2 hours (Stages 1-4)
- **Implementation Time**: 3 days (with parallel execution)
- **Integration Time**: 1 day (Stage 7)
- **Total Time**: 4.5 days (vs. 12 days sequential)
- **Time Saved**: 7.5 days (62% reduction)

## Conclusion

The Multi-Stage Orchestration Workflow successfully delivered the Order Management MVP in 4.5 days with high quality and no integration issues. Parallel execution was the key enabler, saving 7.5 days compared to sequential implementation.

**Recommendation**: Use this workflow for all complex features going forward.
```

### Updated Standards

**File**: `.opencode/context/core/workflows/contract-first-design.md`

```markdown
# Contract-First Design Pattern

## Overview

Define API contracts before implementation to enable parallel frontend/backend development.

## Process

1. **Define Contracts** (Stage 5)
   - Create OpenAPI 3.0 specs
   - Define TypeScript interfaces
   - Document request/response schemas

2. **Enable Parallel Work**
   - Frontend uses mock server (Prism)
   - Backend implements against contract
   - Both work independently

3. **Validate Integration**
   - Consumer-driven contract tests
   - Provider verification tests
   - Integration tests

## Benefits

- Parallel development (frontend + backend)
- Clear integration points
- Reduced integration issues
- Better API design

## Example

See: `.opencode/docs/workflows/full-project-workflow.md` (Stage 5)
```

---

## Summary

### Workflow Stages Completed

1. ✅ **Architecture Decomposition**: 4 bounded contexts identified (Order Management, Inventory, Payment, Notification)
2. ✅ **Story Mapping**: 5 user stories mapped to 2 vertical slices
3. ✅ **Prioritization**: 4 MVP stories prioritized using RICE/WSJF
4. ✅ **Enhanced Task Breakdown**: 12 atomic subtasks created with dependencies
5. ✅ **Contract Definition**: 3 API contracts defined with OpenAPI specs
6. ✅ **Parallel Execution**: 6 batches executed, 5 tasks in parallel (Batch 2)
7. ✅ **Integration & Validation**: All tests passing, performance targets met
8. ✅ **Release & Learning**: Deployed to production, lessons captured

### Key Metrics

- **Total Tasks**: 12
- **Parallel Batches**: 6
- **Max Parallel Tasks**: 5 (Batch 2)
- **Implementation Time**: 3 days (vs. 12 days sequential)
- **Time Saved**: 7.5 days (62% reduction)
- **Test Coverage**: 100% (unit + integration)
- **Performance**: 1.2s order placement (target: < 2s)
- **Success Rate**: 97% (target: 95%)

### Agents Used

- **OpenCoder**: Orchestration across all stages
- **ArchitectureAnalyzer**: Bounded context identification
- **StoryMapper**: User journey mapping
- **PrioritizationEngine**: RICE/WSJF scoring
- **TaskManager**: Task breakdown and JSON generation
- **ContractManager**: API contract definition
- **BatchExecutor**: Parallel batch coordination
- **CoderAgent**: Implementation (12 instances)
- **ContextScout**: Context discovery (multiple calls)
- **ExternalScout**: Stripe and SendGrid docs

### Files Created

**Planning Outputs**:
- `.tmp/tasks/order-management-system/contexts.json`
- `.tmp/planning/order-management-system/map.json`
- `.tmp/planning/prioritized.json`

**Task Definitions**:
- `.tmp/tasks/order-management-mvp/task.json`
- `.tmp/tasks/order-management-mvp/subtask_01.json` through `subtask_12.json`

**Contracts**:
- `.tmp/contracts/order-management/order-api/contract.json`
- `.tmp/contracts/order-management/order-api/contract.openapi.yaml`
- `.tmp/contracts/inventory/inventory-api/contract.json`
- `.tmp/contracts/payment/payment-api/contract.json`

**Implementation**:
- `src/orders/` (cart service, order service, types)
- `src/inventory/` (reservation service)
- `src/payment/` (payment service with Stripe)
- `src/notification/` (email service with SendGrid, event handlers)
- `src/api/orders/` (REST API endpoints)
- `migrations/` (database schema)
- `tests/integration/` (end-to-end tests)
- `docs/api/` (OpenAPI spec, Swagger UI)

**Documentation**:
- `.tmp/validation/order-management-mvp-report.md`
- `docs/retrospectives/order-management-mvp.md`
- `.opencode/context/core/workflows/contract-first-design.md`

### CLI Commands Used

```bash
# Stage 4: Task Breakdown
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  validate order-management-mvp

# Stage 6: Parallel Execution
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  parallel order-management-mvp

# Stage 6: Mark Task Complete (per task)
bash .opencode/skills/task-management/router.sh complete \
  order-management-mvp 01 "Project structure and dependencies configured"

# Stage 6: Check Status
npx ts-node --compiler-options '{"module":"commonjs"}' \
  .opencode/skills/task-management/scripts/task-cli.ts \
  status order-management-mvp

# Stage 7: Run Tests
npm run test:integration
npm run test:performance

# Stage 8: Deploy
npm run deploy:staging
npm run deploy:production
```

---

## Conclusion

This end-to-end example demonstrates the complete Multi-Stage Orchestration Workflow in action:

1. **Systematic Decomposition**: Breaking down complexity through architecture analysis, story mapping, and prioritization
2. **Enhanced Task Planning**: Using planning agent outputs to enrich task definitions with bounded contexts, contracts, and ADRs
3. **Contract-First Design**: Defining interfaces upfront to enable parallel development
4. **Parallel Execution**: Executing independent tasks simultaneously to maximize throughput
5. **Continuous Validation**: Integrating and testing throughout the process
6. **Learning Capture**: Documenting insights to improve future iterations

**Result**: A production-ready Order Management MVP delivered in 4.5 days with 62% time savings, high quality, and zero integration issues.

**Key Success Factors**:
- Clear bounded contexts from ArchitectureAnalyzer
- User-centric stories from StoryMapper
- Data-driven prioritization from PrioritizationEngine
- Atomic tasks with dependencies from TaskManager
- Well-defined contracts from ContractManager
- Effective parallel coordination from BatchExecutor
- Quality-focused implementation from CoderAgent
- Systematic learning capture

This workflow is now the recommended approach for all complex feature development in the OpenAgents ecosystem.
