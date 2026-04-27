'use client';

import { useState } from 'react';
import Sidebar from '@/components/sidebar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';

type EmployeeStatus = 'active' | 'inactive';

type Employee = {
    id: number;
    name: string;
    role: string;
    email: string;
    phone: string;
    status: EmployeeStatus;
    image?: string;
};

type FilterType = 'all' | 'active' | 'inactive';

const employees: Employee[] = [
    {
        id: 1,
        name: 'Sarah',
        role: 'Assistant',
        email: 'sarah@gmail.com',
        phone: '081234567890',
        status: 'active',
        image: '/images/sarah.jpg',
    },
    {
        id: 2,
        name: 'Staff 2',
        role: 'Role',
        email: 'staff02@gmail.com',
        phone: '087462784260',
        status: 'active',
    },
    {
        id: 3,
        name: 'Staff 3',
        role: 'Role',
        email: 'staff03@gmail.com',
        phone: '083612038462',
        status: 'inactive',
    },
];

const clinicFields = [
    {
        label: 'Clinic Name',
        name: 'clinicName',
    },
    {
        label: 'SIPB No',
        name: 'sipbNo',
    },
    {
        label: 'Clinic Address',
        name: 'clinicAddress',
    },
    {
        label: 'Clinic Phone Number',
        name: 'clinicPhoneNumber',
    },
    {
        label: 'Clinic Email',
        name: 'clinicEmail',
    },
    {
        label: 'STR number',
        name: 'strNumber',
    },
];

const ManagementSetting = () => {
    const [filter, setFilter] = useState<FilterType>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEmployees = employees.filter((employee) => {
        const matchesFilter =
            filter === 'all' ? true : employee.status === filter;

        const matchesSearch = employee.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    return (
        <div className="min-h-screen flex bg-[#FDFEF9] overflow-x-hidden">
            <Sidebar />

            <main className="flex-1 flex flex-col ml-0 pt-[26px] pb-[40px] pl-[28px] pr-[28px] min-w-0 overflow-x-hidden">
                <div className="w-full max-w-[960px]">
                    
                    <div className="mt-[28px] w-full max-w-[790px]">
                        <div className="relative w-full outline outline-1 outline-gray-300 rounded-lg px-4 py-2 shadow-sm transition-all focus-within:outline-[#739072]">
                            <FontAwesomeIcon
                                icon={faSearch}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 text-gray-400"
                            />

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) =>
                                    setSearchQuery(event.target.value)
                                }
                                placeholder="Search for a profile"
                                className="w-full bg-transparent pl-8 text-gray-700 placeholder-gray-400 outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-[24px] w-full max-w-[790px] flex items-center justify-between">
                        <h2 className="text-[22px] leading-none font-semibold text-[#5F785F]">
                            Employees
                        </h2>

                        <div className="flex items-center gap-[28px] text-[12px] font-bold text-black">
                            <button
                                type="button"
                                onClick={() => setFilter('all')}
                                className={`min-w-[52px] h-[28px] rounded-[50px] px-4 transition-all ${
                                    filter === 'all'
                                        ? 'bg-[#86A789] text-black shadow-sm'
                                        : 'bg-transparent text-black'
                                }`}
                            >
                                All
                            </button>

                            <button
                                type="button"
                                onClick={() => setFilter('active')}
                                className={`h-[28px] transition-all ${
                                    filter === 'active'
                                        ? 'text-[#5F785F] underline underline-offset-[4px]'
                                        : 'text-black'
                                }`}
                            >
                                Active
                            </button>

                            <button
                                type="button"
                                onClick={() => setFilter('inactive')}
                                className={`h-[28px] transition-all ${
                                    filter === 'inactive'
                                        ? 'text-[#5F785F] underline underline-offset-[4px]'
                                        : 'text-black'
                                }`}
                            >
                                Inactive
                            </button>
                        </div>
                    </div>

                    <div className="mt-[24px] w-full max-w-[790px] grid grid-cols-1 md:grid-cols-3 gap-[30px]">
                        {filteredEmployees.map((employee) => (
                            <div
                                key={employee.id}
                                className="w-full min-h-[250px] rounded-[24px] border border-[#86A789] bg-transparent px-[20px] pt-[24px] pb-[18px] shadow-md flex flex-col items-center"
                            >
                                <div className="relative w-[70px] h-[70px] rounded-full bg-[#D9D9D9] overflow-hidden flex items-center justify-center">
                                    <span className="text-[18px] font-semibold text-[#5F785F]">
                                        {employee.name.charAt(0)}
                                    </span>

                                    {employee.image && (
                                        <img
                                            src={employee.image}
                                            alt={`${employee.name} profile`}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            onError={(event) => {
                                                event.currentTarget.style.display =
                                                    'none';
                                            }}
                                        />
                                    )}
                                </div>

                                <h3 className="mt-[10px] text-[14px] leading-none font-semibold text-[#5F785F]">
                                    {employee.name}
                                </h3>

                                <p className="mt-[6px] text-[10px] leading-none text-[#5F785F]">
                                    {employee.role}
                                </p>

                                <div className="mt-[18px] w-full bg-[#EEF3E9] px-[14px] py-[14px]">
                                    <p className="text-[10px] leading-none text-[#5F785F]">
                                        Email
                                    </p>

                                    <p className="mt-[5px] text-[10px] leading-none text-[#5F785F]">
                                        {employee.email}
                                    </p>

                                    <p className="mt-[12px] text-[10px] leading-none text-[#5F785F]">
                                        No Hp
                                    </p>

                                    <p className="mt-[5px] text-[10px] leading-none text-[#5F785F]">
                                        {employee.phone}
                                    </p>

                                    <button
                                        type="button"
                                        className="mt-[14px] mx-auto h-[28px] min-w-[110px] rounded-[50px] bg-[#86A789] px-5 text-[11px] font-bold text-black shadow-sm transition-all hover:bg-[#739072]"
                                    >
                                        Detail
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <section className="mt-[58px] w-full max-w-[790px]">
                        <h2 className="text-[22px] leading-none font-semibold text-[#5F785F]">
                            Clinic Information
                        </h2>

                        <div className="mt-[14px] w-full rounded-[24px] border border-[#86A789] bg-transparent px-[42px] py-[34px] shadow-md">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[90px] gap-y-[14px]">
                                {clinicFields.map((field) => (
                                    <label key={field.name} className="block">
                                        <span className="text-[10px] font-medium text-[#4B4B4B]">
                                            {field.label}
                                        </span>

                                        <input
                                            type="text"
                                            name={field.name}
                                            className="mt-[6px] h-[28px] w-full rounded-[4px] border border-[#C8D0C3] bg-[#E9EEE5] px-2 text-[11px] text-[#222222] outline-none focus:border-[#739072] focus:ring-1 focus:ring-[#739072]"
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="mt-[28px] flex justify-center">
                                <button
                                    type="button"
                                    className="h-[28px] min-w-[100px] rounded-[50px] bg-[#86A789] px-6 text-[11px] font-bold text-black shadow-sm transition-all hover:bg-[#739072]"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default ManagementSetting;