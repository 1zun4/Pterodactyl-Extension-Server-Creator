import { useState } from 'react';

/** Game artwork in Steam's header format, or the game's name when there is none. */
export default function Artwork({ src, name, className = '' }: { src: string | null; name: string; className?: string }) {
    const [failed, setFailed] = useState(false);

    return (
        <div className={`srvc:relative srvc:aspect-[460/215] srvc:overflow-hidden srvc:rounded-sm srvc:bg-sunken ${className}`}>
            {src && !failed ? (
                <img src={src} alt='' loading='lazy' referrerPolicy='no-referrer' onError={() => setFailed(true)} className='srvc:h-full srvc:w-full srvc:object-cover' />
            ) : (
                <span className='srvc:absolute srvc:inset-0 srvc:flex srvc:items-center srvc:justify-center srvc:p-3 srvc:text-center srvc:font-header srvc:text-lg srvc:font-semibold srvc:text-muted-foreground'>{name}</span>
            )}
        </div>
    );
}
