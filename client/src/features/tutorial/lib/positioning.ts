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
  popoverWidth = 384, // max-w-sm ~24rem
  popoverHeight = 250, // Approximate height
  offset = 20 // Distance from target
): PopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top = 0;
  let left = 0;
  let transform = '';
  let actualPlacement = placement; // Track the actual placement used

  // Calculate center points of target
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  switch (placement) {
    case 'top':
      top = targetRect.top - popoverHeight - offset + scrollY;
      left = targetCenterX - popoverWidth / 2 + scrollX;
      transform = 'translateX(0)';

      // Prevent going above viewport
      if (top < scrollY + 10) {
        // Flip to bottom
        top = targetRect.bottom + offset + scrollY;
        actualPlacement = 'bottom';
      }
      break;

    case 'bottom':
      top = targetRect.bottom + offset + scrollY;
      left = targetCenterX - popoverWidth / 2 + scrollX;
      transform = 'translateX(0)';

      // Prevent going below viewport
      if (top + popoverHeight > scrollY + viewportHeight - 10) {
        // Flip to top
        top = targetRect.top - popoverHeight - offset + scrollY;
        actualPlacement = 'top';
      }
      break;

    case 'left':
      top = targetCenterY - popoverHeight / 2 + scrollY;
      left = targetRect.left - popoverWidth - offset + scrollX;
      transform = 'translateY(0)';

      // Prevent going off left edge
      if (left < scrollX + 10) {
        // Flip to right
        left = targetRect.right + offset + scrollX;
        actualPlacement = 'right';
      }
      break;

    case 'right':
      top = targetCenterY - popoverHeight / 2 + scrollY;
      left = targetRect.right + offset + scrollX;
      transform = 'translateY(0)';

      // Prevent going off right edge
      if (left + popoverWidth > scrollX + viewportWidth - 10) {
        // Flip to left
        left = targetRect.left - popoverWidth - offset + scrollX;
        actualPlacement = 'left';
      }
      break;
  }

  // Ensure popover stays within horizontal bounds
  if (left < scrollX + 10) {
    left = scrollX + 10;
  } else if (left + popoverWidth > scrollX + viewportWidth - 10) {
    left = scrollX + viewportWidth - popoverWidth - 10;
  }

  // Ensure popover stays within vertical bounds
  if (top < scrollY + 10) {
    top = scrollY + 10;
  } else if (top + popoverHeight > scrollY + viewportHeight - 10) {
    top = scrollY + viewportHeight - popoverHeight - 10;
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
