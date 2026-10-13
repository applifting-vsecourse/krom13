import { Plus, X } from "lucide-react"
import { useFieldArray, type Control } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import {
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  type QuackFormValues,
} from "@/features/quack/api/quackFormSchema"

type PollFieldsProps = {
  control: Control<QuackFormValues>
  isDisabled?: boolean
}

export function PollFields({ control, isDisabled = false }: PollFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "options" })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((item, index) => (
        <FormField
          key={item.id}
          control={control}
          name={`options.${index}.text`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Answer {index + 1}</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    maxLength={POLL_OPTION_MAX_LENGTH + 20}
                    disabled={isDisabled}
                    {...field}
                  />
                </FormControl>
                {index >= MIN_POLL_OPTIONS ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove answer ${index + 1}`}
                    disabled={isDisabled}
                    onClick={() => remove(index)}
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={isDisabled || fields.length >= MAX_POLL_OPTIONS}
        onClick={() => append({ text: "" })}
      >
        <Plus className="size-4" />
        Add answer
      </Button>
    </div>
  )
}
