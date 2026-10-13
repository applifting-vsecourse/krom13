import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { MOOD_EMOJI, MOODS } from "@/lib/moods"
import { cn } from "@/lib/utils"

import {
  MAX_BIO_LENGTH,
  profileSchema,
  type ProfileValues,
} from "@/features/auth/api/profileSchema"
import { ProfileUpdateError } from "@/features/auth/api/updateProfile"
import { useUpdateProfile } from "@/features/auth/hooks/useUpdateProfile"

type SettingsFormProps = {
  // What is saved right now; Discard goes back to this.
  saved: ProfileValues
  onSaved?: (values: ProfileValues) => void
}

export function SettingsForm({ saved, onSaved }: SettingsFormProps) {
  const updateProfile = useUpdateProfile()
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: saved,
  })

  const bio = useWatch({ control: form.control, name: "bio" })
  const bioLength = bio?.length ?? 0

  const handleSubmit = (values: ProfileValues) => {
    updateProfile.mutate(values, {
      onSuccess: () => {
        // The server stores usernames lowercase; show what was saved.
        const next = { ...values, username: values.username.toLowerCase() }
        form.reset(next)
        onSaved?.(next)
      },
      onError: (error) => {
        // Keep what was typed and show the problem next to the field.
        if (error instanceof ProfileUpdateError && error.code === "USERNAME_IS_ALREADY_TAKEN") {
          form.setError("username", { message: "That username is already taken" })
        }
      },
    })
  }

  const handleDiscard = () => {
    updateProfile.reset()
    form.reset(saved)
  }

  const formError =
    updateProfile.error &&
    !(
      updateProfile.error instanceof ProfileUpdateError &&
      updateProfile.error.code === "USERNAME_IS_ALREADY_TAKEN"
    )
      ? updateProfile.error.message
      : null

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6"
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        {updateProfile.isSuccess && !form.formState.isDirty ? (
          <Alert
            role="status"
            className="border-success bg-success text-success-foreground *:data-[slot=alert-description]:text-success-foreground"
          >
            <AlertDescription>Settings saved</AlertDescription>
          </Alert>
        ) : null}

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
                  {...field}
                />
              </FormControl>
              <div className="flex items-start justify-between gap-3">
                <FormMessage />
                <span
                  className={cn(
                    "ml-auto text-sm",
                    bioLength > MAX_BIO_LENGTH ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {bioLength}/{MAX_BIO_LENGTH}
                </span>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultMood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default mood for new quacks (optional)</FormLabel>
              <FormControl>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={field.value ?? ""}
                  onValueChange={(value) => field.onChange(value === "" ? null : value)}
                  aria-label="Default mood"
                  rovingFocus={false}
                >
                  {MOODS.map((mood) => (
                    <ToggleGroupItem
                      key={mood}
                      value={mood}
                      aria-label={mood}
                      title={mood}
                      className="px-3 text-lg"
                    >
                      {MOOD_EMOJI[mood]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={updateProfile.isPending}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </Form>
  )
}
