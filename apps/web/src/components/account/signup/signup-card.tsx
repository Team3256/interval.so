'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { trpc } from '@/src/trpc/trpc-client';
import { ArrowPathIcon } from '@heroicons/react/16/solid';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserSchema } from '@hours.frc.sh/api/app/user/schemas/user_schema';
import { WebAuthnError, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
import { TRPCClientError } from '@trpc/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';

const formSchema = UserSchema.pick({ displayName: true });

export function SignupCard() {
	const router = useRouter();
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			displayName: '',
		},
	});

	const getRegistrationOptions = trpc.auth.register.generateRegistrationOptions.useMutation();
	const finishRegistration = trpc.auth.register.verifyRegistrationResponse.useMutation({
		onSuccess: () => {
			router.push('/');
			router.refresh();
		},
	});

	const [isPending, setIsPending] = useState(false);

	const wrappedGetRegistrationOptions = async (values: z.infer<typeof formSchema>) => {
		try {
			return await getRegistrationOptions.mutateAsync(values);
		} catch (error) {
			if (error instanceof TRPCClientError) {
				toast.error(`An error occurred while preparing to register a passkey: ${error.message}`);
			} else {
				toast.error(`An unknown error occurred while preparing to register a passkey: ${error}`);
			}

			throw error;
		}
	};

	const wrappedStartRegistration = async (registrationOptions: PublicKeyCredentialCreationOptionsJSON) => {
		try {
			return await startRegistration(registrationOptions);
		} catch (error) {
			if (error instanceof Error) {
				if (
					error.name === 'NotAllowedError' ||
					(error instanceof WebAuthnError &&
						error.code === 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY' &&
						error.cause instanceof Error &&
						error.cause.name === 'NotAllowedError')
				) {
					toast.error('Registration cancelled');
				} else {
					toast.error(`An error occurred while registering a passkey for your account: ${error.message}`);
				}
			} else {
				toast.error(`An unknown error occurred while registering a passkey for your account: ${error}`);
			}

			throw error;
		}
	};

	const wrappedFinishRegistration = async (registration: RegistrationResponseJSON) => {
		try {
			await finishRegistration.mutateAsync({ user: form.getValues(), body: registration });
		} catch (error) {
			if (error instanceof TRPCClientError) {
				toast.error(`An error occurred while finalizing your registration: ${error.message}`);
			} else {
				toast.error(`An unknown error occurred while finalizing your registration: ${error}`);
			}

			throw error;
		}
	};

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		setIsPending(true);

		try {
			const registrationOptions = await wrappedGetRegistrationOptions(values);

			const registration = await wrappedStartRegistration(registrationOptions);

			await wrappedFinishRegistration(registration);
		} catch {
			return;
		} finally {
			setIsPending(false);
		}

		toast.success('Your account was created');
	};

	return (
		<Card>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)}>
					<CardHeader>
						<CardTitle>Sign up</CardTitle>
					</CardHeader>
					<CardContent>
						<FormField
							control={form.control}
							name='displayName'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Display name</FormLabel>
									<FormControl {...field}>
										<Input {...field} className='max-w-60' type='text' autoComplete='name' />
									</FormControl>
									<FormDescription>
										Please enter your full name, or a display name you are comfortable with.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</CardContent>

					<CardFooter className='justify-end'>
						<Button type='submit' disabled={isPending} size='lg' className='w-full'>
							{isPending && <ArrowPathIcon className='h-4 w-4 animate-spin' />}
							{!isPending && 'Sign up'}
						</Button>
					</CardFooter>
				</form>
			</Form>
		</Card>
	);
}