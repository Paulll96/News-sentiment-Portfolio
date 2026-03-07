import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * DecryptedText
 *
 * Props:
 * - text: string
 * - speed: number
 * - maxIterations: number
 * - sequential: boolean
 * - revealDirection: "start" | "end" | "center"
 * - useOriginalCharsOnly: boolean
 * - characters: string
 * - className: string
 * - parentClassName: string
 * - encryptedClassName: string
 * - animateOn: "view" | "hover"  // default is "hover"
 * - ...props: any other props for the container
 */
export default function DecryptedText({
    text,
    speed = 50,
    maxIterations = 10,
    sequential = false,
    revealDirection = 'start',
    useOriginalCharsOnly = false,
    characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
    className = '',
    parentClassName = '',
    encryptedClassName = '',
    animateOn = 'hover',
    ...props
}) {
    const [displayText, setDisplayText] = useState(text);
    const [isHovering, setIsHovering] = useState(false);
    const [isScrambling, setIsScrambling] = useState(false);
    const [revealedIndices, setRevealedIndices] = useState(new Set());
    const [hasAnimated, setHasAnimated] = useState(false); // For "view" animation

    const containerRef = useRef(null);

    useEffect(() => {
        let interval;
        let currentIteration = 0;

        const getNextIndex = (revealedSet) => {
            const textLength = text.length;
            switch (revealDirection) {
                case 'start':
                    return revealedSet.size;
                case 'end':
                    return textLength - 1 - revealedSet.size;
                case 'center': {
                    const middle = Math.floor(textLength / 2);
                    const offset = Math.floor(revealedSet.size / 2);
                    const nextIndex =
                        revealedSet.size % 2 === 0
                            ? middle + offset
                            : middle - offset - 1;

                    if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
                        return nextIndex;
                    }
                    for (let i = 0; i < textLength; i++) {
                        if (!revealedSet.has(i)) return i;
                    }
                    return 0;
                }
                default:
                    return revealedSet.size;
            }
        };

        const shuffleText = (originalText, currentRevealed) => {
            if (useOriginalCharsOnly) {
                const positions = originalText.split('').map((char, i) => ({
                    char,
                    isRevealed: currentRevealed.has(i),
                }));

                const nonRevealedChars = positions
                    .filter((p) => !p.isRevealed)
                    .map((p) => p.char);

                for (let i = nonRevealedChars.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [nonRevealedChars[i], nonRevealedChars[j]] = [
                        nonRevealedChars[j],
                        nonRevealedChars[i],
                    ];
                }

                let charIndex = 0;
                return positions
                    .map((p) => {
                        if (p.isRevealed) return p.char;
                        return nonRevealedChars[charIndex++];
                    })
                    .join('');
            } else {
                return originalText
                    .split('')
                    .map((char, i) => {
                        if (char === ' ') return ' ';
                        if (currentRevealed.has(i)) return originalText[i];
                        return characters[Math.floor(Math.random() * characters.length)];
                    })
                    .join('');
            }
        };

        if (isScrambling) {
            interval = setInterval(() => {
                setRevealedIndices((prevRevealed) => {
                    if (sequential) {
                        if (prevRevealed.size < text.length) {
                            const nextIndex = getNextIndex(prevRevealed);
                            const newRevealed = new Set(prevRevealed);
                            newRevealed.add(nextIndex);
                            setDisplayText(shuffleText(text, newRevealed));
                            return newRevealed;
                        } else {
                            clearInterval(interval);
                            setIsScrambling(false);
                            return prevRevealed;
                        }
                    } else {
                        setDisplayText(shuffleText(text, prevRevealed));
                        currentIteration++;
                        if (currentIteration >= maxIterations) {
                            clearInterval(interval);
                            setIsScrambling(false);
                            setDisplayText(text);
                        }
                        return prevRevealed;
                    }
                });
            }, speed);
        } else {
            setDisplayText(text);
            setRevealedIndices(new Set());
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [
        isScrambling,
        text,
        speed,
        maxIterations,
        sequential,
        revealDirection,
        useOriginalCharsOnly,
        characters,
    ]);

    useEffect(() => {
        if (animateOn === 'view') {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && !hasAnimated) {
                            setIsScrambling(true);
                            setHasAnimated(true);
                        }
                    });
                },
                { threshold: 0.1 }
            );

            if (containerRef.current) {
                observer.observe(containerRef.current);
            }

            return () => {
                if (containerRef.current) {
                    observer.unobserve(containerRef.current);
                }
            };
        }
    }, [animateOn, hasAnimated]);

    const handleMouseEnter = () => {
        if (animateOn === 'hover') {
            setIsScrambling(true);
            setIsHovering(true);
        }
    };

    const handleMouseLeave = () => {
        if (animateOn === 'hover') {
            setIsHovering(false);
        }
    };

    return (
        <motion.span
            ref={containerRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={`inline-block ${parentClassName}`}
            {...props}
        >
            <span className="sr-only">{displayText}</span>
            <span aria-hidden="true" className={className}>
                {displayText.split('').map((char, index) => {
                    const isRevealedOrDone =
                        revealedIndices.has(index) || !isScrambling || !isHovering;

                    if (animateOn === 'view') {
                        const isRevealedForView = revealedIndices.has(index) || (!isScrambling && hasAnimated);
                        return (
                            <span
                                key={index}
                                className={isRevealedForView ? className : encryptedClassName}
                            >
                                {char}
                            </span>
                        );
                    }

                    return (
                        <span
                            key={index}
                            className={isRevealedOrDone ? className : encryptedClassName}
                        >
                            {char}
                        </span>
                    );
                })}
            </span>
        </motion.span>
    );
}
