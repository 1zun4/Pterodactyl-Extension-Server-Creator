import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@pterodactyl/sdk';
import { keys, searchUsers } from '../api';

interface Props {
    id: string;
    value: number | null;
    fallback?: { id: number; label: string };
    placeholder?: string;
    onChange: (user: { id: number; username: string; email: string }) => void;
}

/** Searchable user picker backed by the admin user search. */
export default function UserSelect({ id, value, fallback, placeholder = 'Search users', onChange }: Props) {
    const [query, setQuery] = useState('');
    const users = useQuery({ queryKey: keys.users(query), queryFn: () => searchUsers(query) });
    const options = (users.data ?? []).map((user) => ({ value: user.id, label: `${user.username} (${user.email})` }));

    if (fallback && !options.some((option) => option.value === fallback.id)) {
        options.unshift({ value: fallback.id, label: fallback.label });
    }

    return (
        <Select
            id={id}
            placeholder={placeholder}
            searchPlaceholder='Search by name or email'
            value={value}
            onSearchChange={setQuery}
            onChange={(selected) => {
                const user = users.data?.find((item) => item.id === Number(selected));
                user && onChange(user);
            }}
            options={options}
        />
    );
}
