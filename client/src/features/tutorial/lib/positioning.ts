import { TutorialStep } from '../config/steps';

export interface PopoverPosition {
  top: number;
  left: number;
  transform: string;
  actualPlacement: TutorialStep['placement']; // Track actual placement after flips
  arrowOffset?: number; // Horizontal offset for top/bottom arrows, vertical offset for left/right arrows
}

export interface ArrowStyles {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  borderTopColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderRightColor?: string;
  transform?: string;
}

/**
 * Calculate popover position based on target element and placement preference
 * Handles viewport edge detection and adjusts positioning accordingly
 */
export function calculatePopoverPosition(
  targetRect: DOMRect,
  placement: TutorialStep['placement'],
  popoverWidth?: number,
  popoverHeight?: number,
  offset?: number
): PopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // Responsive calculations with clamp approach
  const isMobile = viewportWidth < 640; // sm breakpoint
  const margin = isMobile ? 16 : 10;

  // Use min() to prevent overflow on extreme screens (320px old phones, landscape mode)
  const calculatedWidth = popoverWidth || Math.min(384, viewportWidth - 2 * margin);
  const calculatedHeight = popoverHeight || (isMobile ? 220 : 250);
  const calculatedOffset = offset || (isMobile ? 12 : 20);

  // Safe area consideration for bottom boundary (important for iPhone notch/home indicator)
  const safeAreaBottom = isMobile ? 20 : 0; // Extra margin for iOS safe area

  // Placement fallback: if target too close to edge, prefer bottom or centered
  let finalPlacement = placement;
  const isTargetNearEdge =
    targetRect.left < margin ||
    targetRect.right > viewportWidth - margin ||
    targetRect.top < margin ||
    targetRect.bottom > viewportHeight - margin - safeAreaBottom;

  if (isTargetNearEdge && (placement === 'left' || placement === 'right')) {
    // Fallback to bottom for edge elements
    finalPlacement =
      targetRect.bottom + calculatedHeight + calculatedOffset < viewportHeight ? 'bottom' : 'top';
  }

  let top = 0;
  let left = 0;
  let transform = '';
  let actualPlacement = finalPlacement; // Track the actual placement used

  // Calculate center points of target
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  switch (finalPlacement) {
    case 'top':
      top = targetRect.top - calculatedHeight - calculatedOffset + scrollY;
      left = targetCenterX - calculatedWidth / 2 + scrollX;
      transform = 'translateX(0)';

      // Prevent going above viewport
      if (top < scrollY + margin) {
        // Flip to bottom
        top = targetRect.bottom + calculatedOffset + scrollY;
        actualPlacement = 'bottom';
      }
      break;

    case 'bottom':
      top = targetRect.bottom + calculatedOffset + scrollY;
      left = targetCenterX - calculatedWidth / 2 + scrollX;
      transform = 'translateX(0)';

      // Prevent going below viewport
      if (top + calculatedHeight > scrollY + viewportHeight - margin - safeAreaBottom) {
        // Flip to top
        top = targetRect.top - calculatedHeight - calculatedOffset + scrollY;
        actualPlacement = 'top';
      }
      break;

    case 'left':
      top = targetCenterY - calculatedHeight / 2 + scrollY;
      left = targetRect.left - calculatedWidth - calculatedOffset + scrollX;
      transform = 'translateY(0)';

      // Prevent going off left edge
      if (left < scrollX + margin) {
        // Flip to right
        left = targetRect.right + calculatedOffset + scrollX;
        actualPlacement = 'right';
      }
      break;

    case 'right':
      top = targetCenterY - calculatedHeight / 2 + scrollY;
      left = targetRect.right + calculatedOffset + scrollX;
      transform = 'translateY(0)';

      // Prevent going off right edge
      if (left + calculatedWidth > scrollX + viewportWidth - margin) {
        // Flip to left
        left = targetRect.left - calculatedWidth - calculatedOffset + scrollX;
        actualPlacement = 'left';
      }
      break;
  }

  // Ensure popover stays within horizontal bounds
  if (left < scrollX + margin) {
    left = scrollX + margin;
  } else if (left + calculatedWidth > scrollX + viewportWidth - margin) {
    left = scrollX + viewportWidth - calculatedWidth - margin;
  }

  // Ensure popover stays within vertical bounds
  if (top < scrollY + margin) {
    top = scrollY + margin;
  } else if (top + calculatedHeight > scrollY + viewportHeight - margin - safeAreaBottom) {
    top = scrollY + viewportHeight - calculatedHeight - margin - safeAreaBottom;
  }

  // Calculate arrow offset based on target position relative to popover
  let arrowOffset: number | undefined;

  if (actualPlacement === 'top' || actualPlacement === 'bottom') {
    // For top/bottom: calculate horizontal offset from popover left edge to target center
    arrowOffset = targetCenterX - left;
  } else if (actualPlacement === 'left' || actualPlacement === 'right') {
    // For left/right: calculate vertical offset from popover top edge to target center
    arrowOffset = targetCenterY - top;
  }

  return { top, left, transform, actualPlacement, arrowOffset };
}

/**
 * Get CSS styles for the arrow based on placement and optional offset
 */
export function getArrowStyles(
  placement: TutorialStep['placement'],
  arrowOffset?: number
): ArrowStyles {
  const arrowColor = '#ffffff'; // white background

  switch (placement) {
    case 'top':
      return {
        bottom: '-24px',
        left: arrowOffset !== undefined ? `${arrowOffset}px` : '50%',
        transform: arrowOffset !== undefined ? 'translateX(-50%)' : 'translateX(-50%)',
        borderTopColor: arrowColor,
      };

    case 'bottom':
      return {
        top: '-24px',
        left: arrowOffset !== undefined ? `${arrowOffset}px` : '50%',
        transform: arrowOffset !== undefined ? 'translateX(-50%)' : 'translateX(-50%)',
        borderBottomColor: arrowColor,
      };

    case 'left':
      return {
        right: '-24px',
        top: arrowOffset !== undefined ? `${arrowOffset}px` : '50%',
        transform: arrowOffset !== undefined ? 'translateY(-50%)' : 'translateY(-50%)',
        borderLeftColor: arrowColor,
      };

    case 'right':
      return {
        left: '-24px',
        top: arrowOffset !== undefined ? `${arrowOffset}px` : '50%',
        transform: arrowOffset !== undefined ? 'translateY(-50%)' : 'translateY(-50%)',
        borderRightColor: arrowColor,
      };
  }
}
